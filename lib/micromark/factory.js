import { ok as assert } from 'devlop'
import { splice } from 'micromark-util-chunked'
import { classifyCharacter } from 'micromark-util-classify-character'
import { resolveAll } from 'micromark-util-resolve-all'
import { constants, types } from 'micromark-util-symbol'

// from micromark-extension-gfm-strikethrough
// this resolver pairs equal-length opening and closing delimiters
// and nests inner constructs via resolveAll
export function delimitedSpan (options) {
  const name = options.name
  const marker = options.marker
  const single = options.single ?? true
  const attentionKey = options.attentionKey ?? null

  const tokenizer = {
    name,
    tokenize: tokenizeSpan,
    resolveAll: resolveAllSpan
  }

  return {
    // trigger on the marker
    text: { [marker]: tokenizer },
    // allow nested spans
    insideSpan: { [attentionKey]: [tokenizer] },
    // what markers participates in attention resolution?
    attentionMarkers: { [attentionKey]: [marker] }
  }

  function resolveAllSpan (events, context) {
    // walk through all events
    let index = -1
    while (++index < events.length) {
      // find a closing delimiter
      if (
        events[index][0] === 'enter' &&
        events[index][1].type === seqTmp() &&
        events[index][1]._close
      ) {
        let open = index
        // walk back to find an opening delimiter
        while (open--) {
          // find an delimiter that can open the closer
          if (
            events[open][0] === 'exit' &&
            events[open][1].type === seqTmp() &&
            events[open][1]._open &&
            // if the sizes are the same:
            // then we can pair them up
            (events[index][1].end.offset - events[index][1].start.offset) ===
              (events[open][1].end.offset - events[open][1].start.offset)
          ) {
            events[index][1].type = seq()
            events[open][1].type = seq()

            const wrapper = {
              type: name,
              start: { ...events[open][1].start },
              end: { ...events[index][1].end }
            }

            const text = {
              type: textType(),
              // this represents the content between the delimiters
              // hence, we use the end of the opening delimiter and the start of the closing delimiter
              // as boundaries
              start: { ...events[open][1].end },
              end: { ...events[index][1].start }
            }

            // opening
            const nextEvents = [
              ['enter', wrapper, context],
              ['enter', events[open][1], context],
              ['exit', events[open][1], context],
              ['enter', text, context]
            ]

            const insideSpan = context.parser.constructs.insideSpan[attentionKey]
            if (insideSpan) {
              // between
              splice(
                nextEvents,
                nextEvents.length,
                0,
                resolveAll(insideSpan, events.slice(open + 1, index), context)
              )
            }

            // closing
            splice(nextEvents, nextEvents.length, 0, [
              ['exit', text, context],
              ['enter', events[index][1], context],
              ['exit', events[index][1], context],
              ['exit', wrapper, context]
            ])

            splice(events, open - 1, index - open + 3, nextEvents)
            index = open + nextEvents.length - 2
            break
          }
        }
      }
    }

    index = -1
    while (++index < events.length) {
      if (events[index][1].type === seqTmp()) {
        events[index][1].type = types.data
      }
    }
    return events
  }

  function tokenizeSpan (effects, ok, nok) {
    const previous = this.previous
    const events = this.events
    let size = 0

    return start

    function start (code) {
      assert(code === marker, 'expected marker')

      if (previous === marker && events[events.length - 1][1].type !== types.characterEscape) {
        return nok(code)
      }

      effects.enter(seqTmp())
      return more(code)
    }

    function more (code) {
      const before = classifyCharacter(previous)

      if (code === marker) {
        // if this is the third marker, exit
        if (size > 1) return nok(code)

        effects.consume(code)
        size++
        return more
      }

      if (size < 2 && !single) return nok(code)

      const token = effects.exit(seqTmp())
      const after = classifyCharacter(code)

      token._open = !after || (after === constants.attentionSideAfter && Boolean(before))
      token._close = !before || (before === constants.attentionSideAfter && Boolean(after))

      return ok(code)
    }
  }

  function seqTmp () { return name + 'SequenceTemporary' }
  function seq () { return name + 'Sequence' }
  function textType () { return name + 'Text' }
}
