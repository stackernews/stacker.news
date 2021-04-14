import Container from "react-bootstrap/Container";
import Item from "../../../components/item";
import Layout from "../../../components/layout";

export default function AnItem () {
  return (
    <Layout>
      <Container className='my-4'>
        <Item />
      </Container>
    </Layout>
  )
}