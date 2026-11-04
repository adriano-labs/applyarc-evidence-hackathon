// Eight fictional applicants for the Graphcore Graduate Cloud Platform Engineer form
// the app ships (goal, tech, decision, problem, contribution; letter: motivation,
// evidence). No real people. Each has: notes in a deliberately different style, a
// clarifying answer per likely question, one manual opening sentence, a conflict
// answer (used only if the model raises a conflict on notes or answer), and one
// correcting note that changes exactly one fact. `anchor` is the wording of the
// fact the correction overturns, used to find that fact after extraction.

export const PERSONAS = [
  {
    id: 'priya', style: 'terse bullet notes',
    notes: `10 wk summer placement, Brightwater Analytics (small fintech), Manchester, Jun-Aug 2026
team: me + 2 platform engineers (Mateo, Jen)
- goal: move the nightly risk batch jobs off one big VM onto EKS so they stop blocking each other
- stack: Terraform, EKS, Karpenter, Argo Workflows, Prometheus, Loki
- decision: spot instances for the batch node pool, on-demand for the Argo controller. cheaper, jobs are retryable anyway
- problem: jobs randomly lost progress overnight, ~5% of runs. cause: spot interruptions + checkpoints only every 10 min
- investigated via node termination events in CloudWatch + the job logs. the 2 min warning wasn't enough
- fix: checkpoint every 90 s + a drain handler on the termination notice
- result: nightly run 4h10m -> 2h35m, nothing blocked since
- learned: read the spot termination docs first, not after
- why Graphcore: liked the scheduling side more than the models. want to work on the platform under the models`,
    answerFor: {
      contribution: 'I wrote the Terraform modules for the node pools and the Karpenter autoscaler config myself, and Mateo reviewed them.',
      motivation: 'I want to work on the platform that sits under the models, and Graphcore builds both the hardware and the cloud platform the models run on.',
    },
    conflictAnswer: 'Both are right: the team moved the jobs together, and my own part was the Terraform modules for the node pools and the Karpenter autoscaler config.',
    manualSentence: 'During a ten-week summer placement at Brightwater Analytics in Manchester, our three-person platform team moved the nightly risk batch jobs from a single virtual machine onto EKS.',
    correction: { anchor: 'Karpenter autoscaler config myself', text: 'Correction: Mateo wrote the Karpenter autoscaler config, not me. I wrote the Terraform modules for the node pools and reviewed his autoscaler change.' },
    correctionPlain: 'Mateo wrote the Karpenter autoscaler config, not me. I wrote the Terraform modules for the node pools and reviewed his autoscaler change.',
  },
  {
    id: 'tom', style: 'long rambling notes',
    notes: `OK so the thing I want to write about is the home lab, which started as a joke really. Over the summer of 2025 I was living in a flat in Sheffield with Josh, who does electronics, and we had a pile of three old mini PCs that his uncle's office was throwing out. I'd been doing a cloud module at uni and wanted somewhere to actually run things instead of just reading about them, so I decided to turn the three boxes into a little cluster that could host the things our course society kept losing: the Discord bot, the website for the weekly meetups and a Minecraft server that honestly got more use than either.

I went with Proxmox on all three nodes because I wanted to be able to break VMs without breaking the box, and then k3s inside VMs for the containers, which in hindsight was probably one layer too many but I learned a lot from it. Everything is built with Ansible playbooks from a git repo so I can rebuild a node from nothing in about twenty minutes, I timed it. Storage is a ZFS mirror on the two nodes that had two disks. Monitoring is Prometheus and Grafana with Alertmanager sending to a Discord webhook, which is a bit silly but it works. Josh set up the Tailscale mesh so we could reach the cluster from uni, and he also lent me the second mini PC's RAM, which I still have not returned.

The decision I keep coming back to is k3s inside Proxmox VMs rather than bare metal. The reason was that I wanted snapshots: I could snapshot a VM, try an upgrade, and roll back when it went wrong, which it did, twice. The cost was performance and a lot of confusion about which layer was eating the memory.

The big problem was in October 2025. The Minecraft server kept freezing for ten or twenty seconds every few minutes. Everyone blamed the game. I spent, I think, two evenings reading Grafana graphs and eventually noticed the freezes lined up with ZFS scrub windows and with the ARC cache growing until the VM started swapping. I had given the VM too much memory relative to the host, so the host was squeezing it. I fixed it by capping the ARC to 4 GB and moving the scrub to 4am on Sundays. The freezes stopped. What I learned is to look at the host before the guest, and that memory accounting across three layers is genuinely hard to reason about.

Anyway, it has been running since then, about 14 months now, with one outage when the flat lost power. The society uses the website and the bot every week. I also wrote a small page that shows the cluster status so people stop asking me in the group chat.

Why Graphcore, I like the layer under the application more than the application itself, and I like that the platform work is about getting the most out of specific hardware rather than generic boxes, which is basically what I was doing with three cast-off PCs except at a slightly different scale.

Also my cat sat on the keyboard during the Ansible rebuild once and it still worked, which I count as a test.`,
    answerFor: {
      contribution: 'I did the whole build myself apart from the Tailscale mesh, which Josh set up: the Proxmox install, the k3s VMs, the Ansible playbooks and the monitoring.',
      motivation: 'I like the layer under the application more than the application itself, and Graphcore builds the platform that gets the most out of its own hardware.',
    },
    conflictAnswer: 'Both are right: Josh set up the Tailscale mesh, and I built everything else on the cluster myself.',
    manualSentence: 'Over the summer of 2025 I turned three cast-off mini PCs in our Sheffield flat into a small cluster that hosts our course society\'s Discord bot, website and game server.',
    correction: { anchor: 'Josh set up the Tailscale mesh', text: 'Correction: I set up the Tailscale mesh myself. Josh only lent me the second mini PC\'s RAM.' },
    correctionPlain: 'I set up the Tailscale mesh myself. Josh only lent me the second mini PC\'s RAM.',
  },
  {
    id: 'yusuf', style: 'non-native English',
    notes: `In my last year of university (Ankara, graduation June 2026) we are doing a project for the computer science department. The problem was the department have many old servers and every lecturer is installing the softwares by hand, so every server is different and when one is broken nobody know how to fix.

We are a group of four students. We make an automation with Ansible for install all the servers in same way, and we put a Gitea for keeping the playbooks and one Grafana to see the servers. We choose Ansible and not Puppet because Ansible is not needing an agent on the old servers and the department is not allowing to install new agents. This was important decision.

A big problem: after we run the playbooks the HTTPS of the department website is stop working. Two days we are searching. In the end the problem was the playbook is changing the certificate folder permissions to 600 for the security and the web server user cannot read the files anymore. We fix it with giving the group read permission only for the web server group. I learn that the security change can break the things which are working, and always you must test in a copy first.

Now 11 servers are managed by the playbooks and the new server setup is taking 15 minutes, before was one day.

I want to apply to Graphcore because I like very much the infrastructure part and the operating systems, more than the writing of applications, and Graphcore is making the platform for the running of the models.`,
    answerFor: {
      contribution: 'I wrote the Ansible playbooks for the server setup and I found the certificate permission problem by checking the web server logs.',
      motivation: 'I like very much the infrastructure part and the operating systems, and Graphcore is making the platform for the running of the models.',
    },
    conflictAnswer: 'Both are true: the group made the automation together, and my own part was writing the Ansible playbooks and finding the certificate permission problem.',
    manualSentence: 'For my final-year project in Ankara, four of us automated the setup of the computer science department\'s old servers with Ansible so that every server was installed the same way.',
    correction: { anchor: 'found the certificate permission problem', text: 'Correction: the certificate problem was found by my friend Emre from the web server logs. I wrote the Ansible playbooks and I tested the permission fix.' },
    correctionPlain: 'The certificate problem was found by my friend Emre from the web server logs. I wrote the Ansible playbooks and I tested the permission fix.',
  },
  {
    id: 'hannah', style: 'notes that say only "we"',
    notes: `Final year group project, Edinburgh, October 2025 to April 2026. We built an internal feature flag service for a local travel booking company that sponsored the project. They wanted to switch features on and off per customer group without redeploying.

We used Go for the API, Postgres for the flag definitions, Redis for the cache the SDKs read from, and we deployed it to their existing Kubernetes cluster with Helm. We wrote SDKs for their two languages, TypeScript and Python.

Our main decision was to push flag changes to the SDKs over server-sent events rather than have the SDKs poll. We chose this because polling every few seconds from a few hundred pods would have hammered the service, and the company wanted changes to show up within a second.

The problem we hit was that under load testing the service fell over at around 300 concurrent SSE connections. We assumed it was Go, but it turned out to be the ingress controller's default connection limits plus a per-pod file descriptor limit. We investigated by comparing the numbers in the ingress logs with what the service itself reported, and we found the service was never even seeing the extra connections. We raised the limits and added a connection count to our Grafana dashboards so we would see it next time. We learned that "the service fell over" is rarely the service's fault alone and you have to look at every hop.

By the end we had it handling 2,000 connections in the load test, and the company put it into a staging environment. We were four people: Aoife, Dan, Priti and me.

Why Graphcore: we visited the Bristol office on a course trip, and the platform work was the part of our project we liked best.`,
    answerFor: {
      contribution: 'I built the Grafana dashboards and the alert rules, and I ran the load tests that found the connection limit.',
      motivation: 'We visited the Bristol office on a course trip, and the platform work was the part of our project we liked best.',
    },
    conflictAnswer: 'Both are right: the four of us built the service together, and my own part was the Grafana dashboards, the alert rules and the load tests.',
    manualSentence: 'Between October 2025 and April 2026, four of us in Edinburgh built a feature flag service for a local travel booking company that sponsored our final-year project.',
    correction: { anchor: 'alert rules', text: 'One correction: Aoife wrote the alert rules, not me. I built the Grafana dashboards and ran the load tests.' },
    correctionPlain: 'Aoife wrote the alert rules, not me. I built the Grafana dashboards and ran the load tests.',
  },
  {
    id: 'dev', style: 'notes missing the individual contribution (third person, passive)',
    notes: `Project: CI pipeline and preview environments for a student startup's web app (Bristol, part-time, Jan to Jun 2026). The team had five developers and no automated builds; every deploy was done from one laptop.

Goal: every pull request gets a preview environment with its own URL, and merges to main deploy automatically.

Technologies: GitHub Actions, Docker, a small Hetzner server running k3s, Traefik for routing, cert-manager for TLS, and a Postgres database per preview created from a nightly snapshot.

Decision: one shared k3s server rather than a managed cluster, because the startup had almost no money and the workloads were small. The trade-off accepted was a single point of failure.

Problem: preview environments would sometimes come up with a broken database, with tables missing. Investigation showed the nightly snapshot job was being killed by the server's out-of-memory killer part way through, leaving a partial dump that restored without errors. The fix was to stream the dump to disk instead of building it in memory, and to check the dump's footer before it was marked good. Lesson: a job that exits is not a job that finished; check the output, not the exit code.

Outcome: 212 pull requests got preview environments over the six months, and the deploy-from-a-laptop practice ended.

Interest in Graphcore: the platform side of the work, especially the scheduling and resource problems, was the most engaging part, and Graphcore's cloud platform is that problem at a much larger scale.`,
    answerFor: {
      contribution: 'I wrote the GitHub Actions workflow that builds the images and runs the integration tests, and I set up the k3s server.',
      motivation: 'The platform side of the work was the most engaging part for me, and Graphcore\'s cloud platform is that problem at a much larger scale.',
    },
    conflictAnswer: 'Both are right: the project was the team\'s, and my own part was the GitHub Actions workflow and the k3s server.',
    manualSentence: 'From January to June 2026 I worked part-time with a five-developer student startup in Bristol to give every pull request its own preview environment and to automate deploys.',
    correction: { anchor: 'runs the integration tests', text: 'Correction to my answer: Lena wrote the integration-test job in the workflow. I wrote the build and push jobs and set up the k3s server.' },
    correctionPlain: 'Lena wrote the integration-test job in the workflow. I wrote the build and push jobs and set up the k3s server.',
  },
  {
    id: 'aisha', style: 'notes with numbers that must not be invented',
    notes: `Placement year at a logistics software company in Leicester, Sept 2025 to Aug 2026. Platform team, I was one of six. The project I want to describe is the move of about a dozen services from a single VM-based deployment to Kubernetes, with the aim of making deploys safe enough to do during the day.

I owned the rollout tooling: Helm charts and a small Python CLI that wrapped helm and kubectl so the other developers did not need to learn them. Argo CD did the syncing. Prometheus and Grafana were already there.

Decision I made: canary releases with automatic rollback on error rate, instead of blue/green. Blue/green would have doubled the database connections during a switch and the database was already near its connection limit. Canary meant only a slice of traffic moved at a time.

Problem: the first canary rollouts rolled back a lot even when nothing was wrong. I investigated by lining up the rollback times with the error rate graph and found the error rate query counted health check 404s from the load balancer as errors. I changed the query to count only requests with a real route, and the false rollbacks stopped. I learned to check what a metric is actually counting before building automation on top of it.

Results: the p95 latency on the order service went from 1.8 s to 300 ms after the move, mostly because the old VM was starved. Deploys went from after-hours only to several a day. I don't have the exact deploy numbers, the team dashboard was reset in June.

Why Graphcore: I liked the release engineering most and I want to work on a platform where the hardware is the point.`,
    answerFor: {
      contribution: 'My own part was the rollout tooling: I wrote the Helm charts and the Python CLI, and I changed the error rate query that caused the false rollbacks.',
      motivation: 'I liked the release engineering most, and I want to work on a platform where the hardware is the point.',
    },
    conflictAnswer: 'Both are right: the team moved the services together, and the rollout tooling and the error rate query were my own work.',
    manualSentence: 'During my placement year on the platform team of a logistics software company in Leicester, I helped move about a dozen services from a single virtual machine onto Kubernetes.',
    correction: { anchor: '1.8 s to 300 ms', text: 'Correction: the p95 on the order service went from 1.8 s to 400 ms, not 300 ms.' },
    correctionPlain: 'The p95 on the order service went from 1.8 s to 400 ms, not 300 ms.',
  },
  {
    id: 'ben', style: 'notes with an internal contradiction',
    notes: `Hackathon-turned-project: a shared GPU box for our university's game dev society, Newcastle, spring 2026. Team of three: me, Sara and Kofi.

The society had one donated workstation with two GPUs and people were SSHing in and killing each other's training runs. We wanted a fair queue.

What we built: a job queue on top of Slurm, with a tiny web front end so people could submit a script and see where they were in the queue, and per-member GPU-hour quotas. Docker for the environments. The migration from "everyone SSHes in" to the queue took four weeks.

The decision: Slurm instead of Kubernetes, because it was one machine and Kubernetes would have been a lot of moving parts for two GPUs. Kofi disagreed at first.

Problem: jobs were being killed at exactly 60 minutes. We thought it was a Slurm time limit, but the limit was set to 8 hours. We eventually found that the web front end was submitting with a default time limit from an old config file that nobody remembered. The lesson was that the layer you wrote yourself is the first place to look, not the last.

By the end all five of us were using it daily, along with around 30 society members. Demo night was in May and the four weeks of migration were the hardest part.`,
    answerFor: {
      contribution: 'I wrote the quota accounting and the web front end; Sara did the Slurm config and Kofi wrote the Docker images.',
      motivation: 'I liked the scheduling problem more than the games, and Graphcore\'s platform is scheduling work on real hardware all day.',
    },
    conflictAnswer: 'The core team was three: me, Sara and Kofi. Two first-year members joined for the last fortnight to help with the demo, which is why I wrote five of us at the end.',
    manualSentence: 'In spring 2026 three of us built a fair GPU job queue for our university game development society\'s donated workstation in Newcastle.',
    correction: { anchor: 'took four weeks', text: 'Correction: the migration took six weeks, not four.' },
    correctionPlain: 'The migration took six weeks, not four.',
  },
  {
    id: 'leo', style: 'very short notes',
    notes: `Set up a three-node k3s cluster on old office desktops for our robotics society so members could run simulation jobs without fighting over one laptop. Pods could not pull images for a whole week; it turned out to be the university proxy settings missing from containerd, and we fixed it in the end.`,
    answerFor: {
      contribution: 'I set up the cluster and wrote the containerd proxy fix; the other members ran their jobs on it.',
      motivation: 'I liked getting the cluster to work more than the robots, and Graphcore\'s platform is that job at scale.',
      decision: 'I chose k3s over full Kubernetes because it installs in one binary and the desktops were old.',
    },
    conflictAnswer: 'Both are right: the society fixed it together in the end, and the proxy fix itself was written by me.',
    manualSentence: 'Our robotics society needed somewhere to run simulation jobs other than one shared laptop, so three old office desktops became a three-node k3s cluster.',
    correction: { anchor: 'set up the cluster', text: 'Correction: Mira set up the cluster. I wrote the containerd proxy fix.' },
    correctionPlain: 'Mira set up the cluster. I wrote the containerd proxy fix.',
  },
];

// Ellie's shipped sample, driven exactly as the README's judge journey describes it.
export const ELLIE = {
  id: 'ellie', style: 'the shipped sample (README judge journey)', sample: 'ellie',
  answerFor: { contribution: 'I wrote the Helm patch that mounted a memory-backed emptyDir with a size limit per job.' },
  conflictAnswer: 'Both are right: the team built the runner, and I wrote the Helm patch myself.',
  manualSentence: 'Our four-person final-year team built a GPU job runner for the department\'s machine learning teaching cluster, from September 2025 to March 2026.',
  correction: { anchor: 'Helm patch', text: 'Sam wrote the Helm patch. I reproduced the failure, tested his fix and wrote the incident notes.' },
};

// The same sample on the no-key fixture, whose hand-written repair only answers its own correction text.
export const ELLIE_FIXTURE = {
  ...ELLIE, id: 'ellie-fixture',
  answerFor: { contribution: 'I found the /dev/shm problem: I read dmesg on the nodes and saw the OOM kills. I wrote the Helm change that mounts a memory-backed emptyDir for each job. I also wrote the per-course quota check in the scheduler extender.' },
  correction: { anchor: 'Helm change', text: 'My teammate Sam wrote the Helm change; I tested it on two of the lab nodes.' },
};

export const ALL = Object.fromEntries([...PERSONAS, ELLIE, ELLIE_FIXTURE].map((p) => [p.id, p]));
