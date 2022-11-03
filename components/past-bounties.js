import React, {useEffect, useState} from "react"
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
            {data && data.getBountiesByUser.map((item) => (
              <Dropdown.Item>
                <Link href={`/items/${item.id}`} passHref>
                  <a>item {item.id}</a>
                  </Link> / {item.bounty} sats / <span style={{color: 'orange'}}>pending</span>
                </Dropdown.Item>
            ))}
            <Dropdown.Item><Link href={`/${item.user.name}/posts`}>see all</Link></Dropdown.Item>
          </Dropdown.Menu>
        </Dropdown>
    )
}