import { HEADER_MAGIC, MAJOR_VERSION, MAX_ATTESTATIONS_PER_TIMESTAMP, MAX_MSG_LENGTH } from './constants.js'
import { Op } from './ops.js'
import { SerializeContext, DeserializeContext } from './encoding.js'
import { Attestation } from './attestation.js'

/**
 * A node in a timestamp proof tree, holding a message digest and edges to child operations/attestations.
 */
export class Timestamp {
  /**
   * @param {Buffer} msg - The message digest for this timestamp node.
   * @throws {Error} If msg is not a Buffer or its length is out of range.
   */
  constructor (msg) {
    if (!(msg instanceof Buffer) || msg.length < 1 || msg.length > MAX_MSG_LENGTH) {
      throw new Error(`Timestamp(): message must be a buffer between 1 and ${MAX_MSG_LENGTH} bytes long`)
    }
    this.msg = msg // Buffer
    this.attestations = [] // Attestation[]
    this.ops = new Map() // Map<Op, Timestamp>
  }

  /**
   * Find an existing stamp, by Op key
   * - uses Op.equals which for OpUnary compares the tag,
   *   and for OpBinary compares the serialized form (tag + arg)
   * @param {Op} op
   * @returns {Timestamp}
   * @throws {Error} if there are more than 1 unique ops of the provided kind.
   */
  getStamp (op) {
    if (!(op instanceof Op)) {
      throw new Error('Timestamp.getStamp: op expects an instance of Op')
    }

    const existing = []
    this.ops.forEach((stamp, existingOp) => {
      if (existingOp.equals(op)) {
        existing.push(stamp)
      }
    })

    if (existing.length > 1) {
      throw new Error(`Timestamp.getStamp: expect 1 unique 0x${op._TAG().toString(16)} op, got ${existing.length}`)
    }

    return existing[0]
  }

  /**
   * Add an op-edge to this timestamp.
   * If an equivalent op key already exists, return its child unchanged.
   * Otherwise, create a new Timestamp as child and return that.
   * @param {Op} op
   * @return {Timestamp}
   */
  add (op) {
    const stamp = this.getStamp(op)
    if (stamp instanceof Timestamp) {
      return stamp
    }
    const childMsg = op.call(this.msg)
    const child = new Timestamp(childMsg)
    this.ops.set(op, child)
    return child
  }

  /**
   * Add an attestation to this Timestamp.
   * - If an equivalent attestation exists, ignore it.
   * @param {Attestation} attn
   * @throws {Error} If the set grows past MAX_ATTESTATIONS_PER_TIMESTAMP.
   */
  addAttestation (attn) {
    if (this.attestations.length >= MAX_ATTESTATIONS_PER_TIMESTAMP) {
      throw new Error(
        `Timestamp.addAttestation: Maximum number of attestations per timestamp is ${MAX_ATTESTATIONS_PER_TIMESTAMP}`
      )
    }
    if (!this.attestations.some(ourAttn => ourAttn.equals(attn))) {
      this.attestations.push(attn)
    }
  }

  /**
   * Merge another Timestamp tree (rooted at the same msg) into this one.
   * Updates in-place.
   * @param {Timestamp} other
   */
  merge (other) {
    if (!(other instanceof Timestamp)) {
      throw new Error('Timestamp.merge: other must be an instance of Timestamp')
    }
    if (!this.msg.equals(other.msg)) {
      throw new Error('Timestamp.merge: attempting to merge with incompatible other (msg differs)')
    }
    other.attestations.forEach(attn => {
      this.addAttestation(attn)
    })

    other.ops.forEach((stamp, op) => {
      const ourStamp = this.getStamp(op)
      if (!ourStamp) {
        this.ops.set(op, stamp)
        return
      }
      ourStamp.merge(stamp)
      this.ops.set(op, ourStamp)
    })
  }

  /**
   * Serialize into ctx using the fork/attestation encoding
   *
   *   - attestations sorted deterministically; all-but-last preceded by [0xff, 0x00]
   *   - ops: all-but-last preceded by [0xff]; each writes op.serialize + child.serialize
   *   - if no ops, last item is the last attestation (preceded by 0x00)
   *   - if ops present, last item is the last op (no leading marker)
   *
   * @param {SerializeContext} ctx
   */
  serialize (ctx) {
    const sortedAttestations = [...this.attestations].sort((a, b) => a.compare(b))
    for (let i = 0; i < sortedAttestations.length - 1; i++) {
      ctx.writeBytes(Buffer.from([0xff, 0x00]))
      sortedAttestations[i].serialize(ctx)
    }
    if (this.ops.size === 0 && sortedAttestations.length > 0) {
      // Pure leaf: just write the last/only attestation
      ctx.writeByte(0x00)
      sortedAttestations[sortedAttestations.length - 1].serialize(ctx)
    } else {
      // Has both attestation(s) and ops, or only ops
      if (sortedAttestations.length > 0) {
        ctx.writeBytes(Buffer.from([0xff, 0x00]))
        sortedAttestations[sortedAttestations.length - 1].serialize(ctx)
      }
      // Write each op/child-timestamp pair; all but the last are preceded by 0xff
      let index = 0
      this.ops.forEach((stamp, op) => {
        if (index < this.ops.size - 1) ctx.writeByte(0xff)
        index++
        op.serialize(ctx) // writes op tag (+ varbytes arg if binary op)
        stamp.serialize(ctx) // recurse into child timestamp
      })
    }
  }

  /**
   * Deserialize a Timestamp from ctx.
   * msg is already known (passed in).
   * Reads a sequence of tagged entries:
   *   0x00 → Attestation.deserialize(ctx), push to .attestations
   *   0xff → another entry follows (continue reading)
   *   other → Op.deserialize(tag, ctx), recurse Timestamp.deserialize(ctx, op.call(msg))
   *
   * @param {DeserializeContext} ctx
   * @param {Buffer} msg
   * @returns {Timestamp}
   */
  static deserialize (ctx, msg) {
    const stamp = new Timestamp(msg)
    let readMore = true

    function deserializeOp (ctx) {
      const op = Op.deserialize(ctx)
      const child = Timestamp.deserialize(ctx, op.call(msg))
      stamp.ops.set(op, child)
    }

    while (readMore) {
      const byte = ctx.peek()
      switch (byte) {
        case 0x00: // this is an attestation
          readMore = false
          ctx.skip(1)
          stamp.addAttestation(Attestation.deserialize(ctx))
          break
        case 0xff:
          readMore = true
          if (ctx.peek(1) === 0x00) {
            ctx.skip(2)
            stamp.addAttestation(Attestation.deserialize(ctx))
            continue
          }
          ctx.skip(1)
          deserializeOp(ctx)
          break
        default: // this is the last op
          readMore = false
          deserializeOp(ctx)
      }
    }

    return stamp
  }
}

/**
 * A detached timestamp file (.ots) pairing a hash operation with a Timestamp proof tree.
 */
export class DetachedTimestampFile {
  /**
   * @param {Op} fileHashOp - The hash operation used to produce the file digest.
   * @param {Timestamp} timestamp - The root timestamp containing the file digest.
   * @throws {Error} If arguments are invalid or digest length mismatches.
   */
  constructor (fileHashOp, timestamp) {
    if (!(fileHashOp instanceof Op)) {
      throw new Error('DetachedTimestampFile(): expect fileHashOp to be an instance of Op')
    }
    if (!(timestamp instanceof Timestamp)) {
      throw new Error('DetachedTimestampFile(): expect timestamp to be an instance of Timestamp')
    }
    if (timestamp.msg.length !== fileHashOp._DIGEST_LENGTH()) {
      throw new Error(`DetachedTimestampFile(): length mismatch. Expected ${fileHashOp._DIGEST_LENGTH()}, got ${timestamp.msg.length}`)
    }

    this.fileHashOp = fileHashOp // e.g. OpSHA256 instance
    this.timestamp = timestamp // Timestamp wrapping the file digest
  }

  /**
   * Construct a blank, unsigned timestamp container from a pre-computed hash.
   * @param {Op} fileHashOp
   * @param {Buffer} hash
   * @returns {DetachedTimestampFile}
   */
  static fromHash (fileHashOp, hash) {
    return new DetachedTimestampFile(fileHashOp, new Timestamp(hash))
  }

  /**
   * Serialize a .ots formatted file to a Buffer
   * @returns {Buffer}
   */
  serializeToBytes () {
    const ctx = new SerializeContext()
    this.serialize(ctx)
    return ctx.getOutput()
  }

  /**
   * Serialize the full .ots file (header, version, hash op, digest, timestamp tree) into ctx.
   * @param {SerializeContext} ctx
   */
  serialize (ctx) {
    ctx.writeBytes(Buffer.from(HEADER_MAGIC))
    ctx.writeVaruint(MAJOR_VERSION)
    this.fileHashOp.serialize(ctx)
    ctx.writeBytes(this.timestamp.msg)
    this.timestamp.serialize(ctx)
  }

  /**
   * Parse a .ots file from a Buffer
   * @param {Buffer} data
   * @returns {DetachedTimestampFile}
   */
  static deserialize (data) {
    const ctx = new DeserializeContext(data)
    ctx.assertMagic(HEADER_MAGIC)
    const version = ctx.readVaruint()
    if (version !== MAJOR_VERSION) {
      throw new Error(`DetachedTimestampFile.deserialize: Expect Major Version to be ${MAJOR_VERSION}, got ${version}`)
    }
    const fileHashOp = Op.deserialize(ctx)
    const hash = ctx.readBytes(fileHashOp._DIGEST_LENGTH())
    const timestamp = Timestamp.deserialize(ctx, hash)
    return new DetachedTimestampFile(fileHashOp, timestamp)
  }
}
