import json, os, re, requests

difficulties = {'good-first-issue':20000,'easy':100000,'medium':250000,'medium-hard':500000,'hard':1000000}
priorities = {'low':0.5,'medium':1.5,'high':2,'urgent':3}
ignored = ['huumn', 'ekzyis']
fn = 'awards.csv'

sess = requests.Session()
headers = {'Authorization':'Bearer %s' % os.getenv('GITHUB_TOKEN') }
awards = []

def getIssue(n):
	url = 'https://api.github.com/repos/stackernews/stacker.news/issues/' + n
	r = sess.get(url, headers=headers)
	j = json.loads(r.text)
	return j

def findIssuesInPR(j):
	p = re.compile('(#|https://github.com/stackernews/stacker.news/issues/)([0-9]+)')
	issues = set()
	for m in p.finditer(j['title']):
		issues.add(m.group(2))
	if not 'body' in j or j['body'] is None:
		return
	for s in j['body'].split('\n'):
		for m in p.finditer(s):
			issues.add(m.group(2))
	return list(issues)

def addAward(user, kind, pr, issue, difficulty, priority, count, amount):
	if amount >= 1000000 and amount % 1000000 == 0:
		amount = str(int(amount / 1000000)) + 'm'
	elif amount >= 1000 and amount % 1000 == 0:
		amount = str(int(amount / 1000)) + 'k'
	for a in awards:
		if a[0] == user and a[1] == kind and a[2] == pr:
			print('found existing entry %s' % a)
			if a[8] != amount:
				print('warning: amount %s != %s' % (a[8], amount))
			return
	if count < 1:
		count = ''
	addr = '???'
	for a in awards:
		if a[0] == user and a[9] != '???':
			addr = a[9]
	print('adding %s,%s,%s,%s,%s,%s,%s,,%s,%s,???' % (user, kind, pr, issue, difficulty, priority, count, amount, addr))
	with open(fn, 'a') as f:
		print('%s,%s,%s,%s,%s,%s,%s,,%s,%s,???' % (user, kind, pr, issue, difficulty, priority, count, amount, addr), file=f)

def countReviews(pr):
	url = 'https://api.github.com/repos/stackernews/stacker.news/issues/%s/timeline' % pr
	r = sess.get(url, headers=headers)
	j = json.loads(r.text)
	count = 0
	for e in j:
		if e['event'] == 'reviewed' and e['state'] == 'changes_requested':
			count += 1
	return count

def checkPR(i):
	pr = str(i['number'])
	print('pr %s' % pr)
	issue_numbers = findIssuesInPR(i)
	if not issue_numbers:
		print('pr %s does not solve any issues' % pr)
		return
	for n in issue_numbers:
		print('solves issue %s' % n)
		j = getIssue(n)
		difficulty = ''
		amount = 0
		priority = ''
		multiplier = 1
		for l in j['labels']:
			for d in difficulties:
				if l['name'] == 'difficulty:' + d:
					difficulty = d
					amount = difficulties[d]
			for p in priorities:
				if l['name'] == 'priority:' + p:
					priority = p
					multiplier = priorities[p]
		if amount * multiplier <= 0:
			print('issue gives no award')
			continue
		count = countReviews(pr)
		if count >= 10:
			print('too many reviews, no award')
			continue
		if count > 0:
			print('%d reviews, %d%% reduction' % (count, count * 10))
		award = amount * multiplier * (10 - count) / 10
		print('award is %d' % award)
		if i['user']['login'] not in ignored:
			addAward(i['user']['login'], 'pr', '#' + pr, '#' + n, difficulty, priority, count, award)
		if j['user']['login'] not in ignored:
			count = 0
			addAward(j['user']['login'], 'issue', '#' + pr, '#' + n, difficulty, priority, count, int(award / 10))

with open(fn, 'r') as f:
	for s in f:
		s = s.split('\n')[0]
		awards.append(s.split(','))

j = json.loads(os.getenv('GITHUB_CONTEXT'))
checkPR(j['event']['pull_request'])
