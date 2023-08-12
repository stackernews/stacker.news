import { useEffect } from 'react'
import Table from 'react-bootstrap/Table'
import ActionTooltip from './action-tooltip'
import Info from './info'
import styles from './fee-button.module.css'
import { gql, useQuery } from '@apollo/client'
import { useFormikContext } from 'formik'
import { SSR, ANON_COMMENT_FEE, ANON_POST_FEE } from '../lib/constants'
import { numWithUnits } from '../lib/format'
import { useMe } from './me'
import AnonIcon from '../svgs/spy-fill.svg'
import { useShowModal } from './modal'
import Link from 'next/link'

function Receipt ({ cost, repetition, hasImgLink, baseFee, parentId, boost }) {
  return (
    <Table className={styles.receipt} borderless size='sm'>
      <tbody>
        <tr>
          <td>{numWithUnits(baseFee, { abbreviate: false })}</td>
          <td align='right' className='font-weight-light'>{parentId ? 'reply' : 'post'} fee</td>
        </tr>
        {hasImgLink &&
          <tr>
            <td>x 10</td>
            <td align='right' className='font-weight-light'>image/link fee</td>
          </tr>}
        {repetition > 0 &&
          <tr>
            <td>x 10<sup>{repetition}</sup></td>
            <td className='font-weight-light' align='right'>{repetition} {parentId ? 'repeat or self replies' : 'posts'} in 10m</td>
          </tr>}
        {boost > 0 &&
          <tr>
            <td>+ {numWithUnits(boost, { abbreviate: false })}</td>
            <td className='font-weight-light' align='right'>boost</td>
          </tr>}
      </tbody>
      <tfoot>
        <tr>
          <td className='fw-bold'>{numWithUnits(cost, { abbreviate: false })}</td>
          <td align='right' className='font-weight-light'>total fee</td>
        </tr>
      </tfoot>
    </Table>
  )
}

function AnonInfo () {
  const showModal = useShowModal()

  return (
    <AnonIcon
      className='fill-muted ms-2 theme' height={22} width={22}
      onClick={
        (e) =>
          showModal(onClose =>
            <div><div className='fw-bold text-center'>You are posting without an account</div>
              <ol className='my-3'>
                <li>You'll pay by invoice</li>
                <li>Your content will be content-joined (get it?!) under the <Link href='/anon' target='_blank'>@anon</Link> account</li>
                <li>Any sats your content earns will go toward <Link href='/rewards' target='_blank'>rewards</Link></li>
                <li>We won't be able to notify you when you receive replies</li>
              </ol>
              <small className='text-center fst-italic text-muted'>btw if you don't need to be anonymous, posting is cheaper with an account</small>
            </div>)
      }
    />
  )
}

export default function FeeButton ({ parentId, hasImgLink, baseFee, ChildButton, variant, text, alwaysShow, disabled }) {
  const me = useMe()
  baseFee = me ? baseFee : (parentId ? ANON_COMMENT_FEE : ANON_POST_FEE)
  const query = parentId
    ? gql`{ itemRepetition(parentId: "${parentId}") }`
    : gql`{ itemRepetition }`
  const { data } = useQuery(query, SSR ? {} : { pollInterval: 1000, nextFetchPolicy: 'cache-and-network' })
  const repetition = me ? data?.itemRepetition || 0 : 0
  const formik = useFormikContext()
  const boost = Number(formik?.values?.boost) || 0
  const cost = baseFee * (hasImgLink ? 10 : 1) * Math.pow(10, repetition) + Number(boost)

  useEffect(() => {
    formik?.setFieldValue('cost', cost)
  }, [formik?.getFieldProps('cost').value, cost])

  const show = alwaysShow || !formik?.isSubmitting
  return (
    <div className={styles.feeButton}>
      <ActionTooltip overlayText={numWithUnits(cost, { abbreviate: false })}>
        <ChildButton variant={variant} disabled={disabled}>{text}{cost > 1 && show && <small> {numWithUnits(cost, { abbreviate: false })}</small>}</ChildButton>
      </ActionTooltip>
      {!me && <AnonInfo />}
      {cost > baseFee && show &&
        <Info>
          <Receipt baseFee={baseFee} hasImgLink={hasImgLink} repetition={repetition} cost={cost} parentId={parentId} boost={boost} />
        </Info>}
    </div>
  )
}

function EditReceipt ({ cost, paidSats, addImgLink, boost, parentId }) {
  return (
    <Table className={styles.receipt} borderless size='sm'>
      <tbody>
        {addImgLink &&
          <>
            <tr>
              <td>{numWithUnits(paidSats, { abbreviate: false })}</td>
              <td align='right' className='font-weight-light'>{parentId ? 'reply' : 'post'} fee</td>
            </tr>
            <tr>
              <td>x 10</td>
              <td align='right' className='font-weight-light'>image/link fee</td>
            </tr>
            <tr>
              <td>- {numWithUnits(paidSats, { abbreviate: false })}</td>
              <td align='right' className='font-weight-light'>already paid</td>
            </tr>
          </>}
        {boost > 0 &&
          <tr>
            <td>+ {numWithUnits(boost, { abbreviate: false })}</td>
            <td className='font-weight-light' align='right'>boost</td>
          </tr>}
      </tbody>
      <tfoot>
        <tr>
          <td className='fw-bold'>{numWithUnits(cost)}</td>
          <td align='right' className='font-weight-light'>total fee</td>
        </tr>
      </tfoot>
    </Table>
  )
}

export function EditFeeButton ({ paidSats, hadImgLink, hasImgLink, ChildButton, variant, text, alwaysShow, parentId }) {
  const formik = useFormikContext()
  const boost = formik?.values?.boost || 0
  const addImgLink = hasImgLink && !hadImgLink
  const cost = (addImgLink ? paidSats * 9 : 0) + Number(boost)

  useEffect(() => {
    formik?.setFieldValue('cost', cost)
  }, [formik?.getFieldProps('cost').value, cost])

  const show = alwaysShow || !formik?.isSubmitting
  return (
    <div className='d-flex align-items-center'>
      <ActionTooltip overlayText={numWithUnits(cost, { abbreviate: false })}>
        <ChildButton variant={variant}>{text}{cost > 0 && show && <small> {numWithUnits(cost, { abbreviate: false })}</small>}</ChildButton>
      </ActionTooltip>
      {cost > 0 && show &&
        <Info>
          <EditReceipt paidSats={paidSats} addImgLink={addImgLink} cost={cost} parentId={parentId} boost={boost} />
        </Info>}
    </div>
  )
}
