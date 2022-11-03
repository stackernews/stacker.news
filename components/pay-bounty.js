import React from "react"
import styles from "./pay-bounty.module.css"
import ActionTooltip from './action-tooltip'
import {useMe} from "./me"

export default function PayBounty({ children, item, bounty }) {
    const me = useMe()

    const fwd2me = me && me?.id === item?.fwdUser?.id

    return (
        <div className={styles.payContainer}>
            <ActionTooltip notForm disable={item?.mine || fwd2me} overlayText={`${bounty} sats`}>
                <div className={styles.pay}>pay-bounty</div>
            </ActionTooltip>
        </div>
    )
}