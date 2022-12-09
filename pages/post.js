import Button from "react-bootstrap/Button";
import { useRouter } from "next/router";
import Link from "next/link";
import LayoutCenter from "../components/layout-center";
import { useMe } from "../components/me";
import { DiscussionForm } from "../components/discussion-form";
import { LinkForm } from "../components/link-form";
import { getGetServerSideProps } from "../api/ssrApollo";
import AccordianItem from "../components/accordian-item";
import { PollForm } from "../components/poll-form";
import { BountyForm } from "../components/bounty-form";

export const getServerSideProps = getGetServerSideProps();

export function PostForm() {
  const router = useRouter();
  const me = useMe();

  if (!router.query.type) {
    return (
      <div className='align-items-center'>
        {me?.freePosts && me?.sats < 1
          ? <div className='text-center font-weight-bold mb-3 text-success'>{me.freePosts} free posts left</div>
          : null}
        <Link href='/post?type=link'>
          <Button variant='secondary'>link</Button>
        </Link>
        <span className="mx-3 font-weight-bold text-muted">or</span>
        <Link href="/post?type=discussion">
          <Button variant="secondary">discussion</Button>
        </Link>
        <div className="d-flex justify-content-center mt-3">
          <AccordianItem
            headerColor="#6c757d"
            header={<div className="font-weight-bold text-muted">more</div>}
            body={
              <div className="align-items-center">
                <Link href="/post?type=poll">
                  <Button variant="info">poll</Button>
                </Link>
                <span className="mx-3 font-weight-bold text-muted">or</span>
                <Link href="/post?type=bounty">
                  <Button variant="info">bounty</Button>
                </Link>
              </div>
            }
          />
        </div>
      </div>
    );
  }

  if (router.query.type === "discussion") {
    return <DiscussionForm adv />;
  } else if (router.query.type === "link") {
    return <LinkForm />;
  } else if (router.query.type === "poll") {
    return <PollForm />;
  } else {
    return <BountyForm />;
  }
}

export default function Post() {
  return (
    <LayoutCenter>
      <PostForm />
    </LayoutCenter>
  );
}
