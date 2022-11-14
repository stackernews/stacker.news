import React from "react"
import { Dropdown } from "react-bootstrap"
import { useQuery } from "@apollo/client"
import ArrowDown from "../svgs/arrow-down-s-fill.svg"
import {BOUNTY_ITEMS_BY_USER} from "../fragments/items"
import Link from "next/link"

export default function PastBounties({ children, item }) {
    const { data } = useQuery(BOUNTY_ITEMS_BY_USER, {
        variables: {
            id: Number(item.user.id),
        },
        fetchPolicy: "cache-first"
    })

    return (
        <Dropdown>
          <Dropdown.Toggle
            style={{ whiteSpace: 'nowrap' }}
            >
          <ArrowDown style={{ fill: 'black' }} height={20} width={20} />
            past bounties
          </Dropdown.Toggle>
          <Dropdown.Menu>
            {data && data.getBountiesByUser.map((bountyItem) => {
              console.log(bountyItem)
              if (bountyItem.id === item.id) {
                return null
              }
              return (
                <Dropdown.Item key={bountyItem.id}>
                    <Link href={`/items/${bountyItem.id}`}>
                      <div>
                        <span>item {bountyItem.id} / {bountyItem.bounty} sats / </span>
                        <span style={{color: bountyItem.bountyPaid == false ? 'orange' : 'lightgreen'}}>{bountyItem.bountyPaid == false ? 'pending' : 'paid'}</span> 
                      </div>
                    </Link>
                </Dropdown.Item>
                )
            })
          }
            <Dropdown.Item>
              <Link href={`/${item.user.name}/posts`}><span style={{color: 'var(--theme-link)'}}>see all</span></Link>
              </Dropdown.Item>
          </Dropdown.Menu>
        </Dropdown>
    )
}