import useCrossposter from './use-crossposter'
import Dropdown from 'react-bootstrap/Dropdown'
import { useToast } from './toast'
import { useMe } from './me'

export default function CrosspostDropdownItem({ item }) {
    const toaster = useToast()
    const me = useMe()
    // Update createdAt
    const crossposter = useCrossposter()
    return (
        <Dropdown.Item
            onClick={async () => {
                try {
                    if (!(await window.nostr.getPublicKey())) {
                      throw new Error('not available')
                    }
                  } catch (e) {
                    throw new Error(`Nostr extension error: ${e.message}`)
                  }

                try {
                    if (item?.id) {
                        await crossposter({ ...item, id: item.id, createdAt: item.createdAt })
                    }
                } catch (e) {
                    console.error(e)
                }
            }}
        >
            {me && !me.nEventId ? 'crosspost to nostr' :
                <Link href={`https://habla.news`} className='text-reset dropdown-item'>
                    nostr note
                </Link>}
        </Dropdown.Item>
    )
}
