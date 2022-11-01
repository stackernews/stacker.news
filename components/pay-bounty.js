import React from "react"
import styles from "./pay-bounty.module.css"

export default function PayBounty({ children, item }) {
    return (
        <div className={styles.payContainer}>
            <div className={styles.pay}>pay-bounty</div>
        </div>
    )
}