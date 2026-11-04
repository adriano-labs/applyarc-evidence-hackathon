# NOT SUBMITTED: Graphcore · Graduate Cloud Platform Engineer 2027

Prepared with ApplyArc Evidence. Nothing has been submitted. Paste each document into the employer’s form yourself and finish the steps below on the employer’s site.

Form: https://job-boards.greenhouse.io/graphcore/jobs/8894977002 (snapshot of 26 Oct 2026)
Prepared: 2 Nov 2026, 23:16 UTC

## Project answer (version 3, 199 of 300 words)

Your own words, not checked against your facts: 1 sentence.

Our four-person final-year team built a GPU job runner for the department's machine learning teaching cluster, from September 2025 to March 2026. Students submitted training jobs through a small web form, and the runner queued them on Kubernetes, using k3s on six old lab workstations with GPUs. In the spring term, 140 students used it, and the average wait for a GPU went from about two days, with the old sign-up sheet, to under 20 minutes.

The stack was Python and FastAPI for the API, Redis for the queue, Helm charts for deploys, and Prometheus and Grafana for monitoring. We used Kubernetes Jobs with a scheduler extender instead of Slurm, because the department wanted everything in containers and we needed per-course GPU quotas.

In week 9, jobs started dying at random, with pods OOMKilled even with tiny models. The default /dev/shm in the pods was 64 MB, so the PyTorch data loaders crashed. The lesson was to check the node's kernel log first, as dmesg showed the OOM kills straight away.

Sam wrote the Helm patch. I reproduced the failure, tested his fix and wrote the incident notes. A memory-backed emptyDir with a size limit per job was mounted.

Your evidence
1. Final-year group project involved four of us from Sept 2025 to March 2026. (your words: “Final-year group project, four of us, Sept 2025 to March 2026.”)
2. We built a self-service GPU job runner for the department's machine learning teaching cluster. (your words: “We built a self-service GPU job runner for the department's machine learning teaching cluster.”)
3. Students submitted training jobs through a small web form, queued on Kubernetes (k3s on six old lab workstations with GPUs). (your words: “Students submitted training jobs through a small web form and the runner queued them on Kubernetes (k3s on six old lab workstations with GPUs).”)
4. 140 students used it in the spring term and average GPU wait went from about two days to under 20 minutes. (your words: “140 students used it in the spring term and the average wait for a GPU went from about two days (the old sign-up sheet) to under 20 minutes”)
5. Stack was Python and FastAPI for the API, Redis for the queue, Helm charts for deploys, Prometheus and Grafana for monitoring. (your words: “Stack: Python and FastAPI for the API, Redis for the queue, Helm charts for deploys, Prometheus and Grafana for monitoring.”)
6. We used Kubernetes Jobs with a scheduler extender instead of Slurm, because the department wanted containers and we needed per-course GPU quotas. (your words: “we used Kubernetes Jobs with a scheduler extender instead of Slurm, because the department wanted everything in containers and we needed per-course GPU quotas”)
7. In week 9 jobs started dying at random, pods OOMKilled even with tiny models. (your words: “in week 9 jobs started dying at random, pods OOMKilled even with tiny models”)
8. The default /dev/shm in the pods was 64 MB, so the PyTorch data loaders crashed. (your words: “Turned out the default /dev/shm in the pods was 64 MB, so the PyTorch data loaders crashed.”)
9. Learned to check the node's kernel log first; dmesg showed the OOM kills straight away. (your words: “check the node's kernel log first. dmesg showed the OOM kills straight away and we wasted two days before looking.”)
10. Sam wrote the Helm patch. I reproduced the failure, tested his fix and wrote the incident notes. (your words: “Sam wrote the Helm patch. I reproduced the failure, tested his fix and wrote the incident notes.”)
11. Fixed it by mounting a memory-backed emptyDir with a size limit per job. (your words: “Fixed it by mounting a memory-backed emptyDir with a size limit per job.”)

## Cover letter (version 2, 199 of 400 words)

Dear Graphcore hiring team,

I am applying for the Graduate Cloud Platform Engineer 2027 role at Graphcore.

I liked infrastructure work more than machine learning, and Graphcore builds both the hardware and the cloud platform that models run on.

We built a self-service GPU job runner for the department's machine learning teaching cluster. Students submitted training jobs through a small web form, and the runner queued them on Kubernetes, using k3s on six old lab workstations with GPUs. The stack was Python and FastAPI for the API, Redis for the queue, Helm charts for deploys, and Prometheus and Grafana for monitoring. We used Kubernetes Jobs with a scheduler extender instead of Slurm, because the department wanted everything in containers and we needed per-course GPU quotas.

In week 9, jobs started dying at random, with pods OOMKilled even with tiny models. Sam wrote the Helm patch. I reproduced the failure, tested his fix and wrote the incident notes. A memory-backed emptyDir with a size limit per job was mounted. 140 students used it in the spring term, and the average GPU wait went from about two days to under 20 minutes.

Thank you for considering my application.

Kind regards, Ellie

Your evidence
2. We built a self-service GPU job runner for the department's machine learning teaching cluster. (your words: “We built a self-service GPU job runner for the department's machine learning teaching cluster.”)
3. Students submitted training jobs through a small web form, queued on Kubernetes (k3s on six old lab workstations with GPUs). (your words: “Students submitted training jobs through a small web form and the runner queued them on Kubernetes (k3s on six old lab workstations with GPUs).”)
4. 140 students used it in the spring term and average GPU wait went from about two days to under 20 minutes. (your words: “140 students used it in the spring term and the average wait for a GPU went from about two days (the old sign-up sheet) to under 20 minutes”)
5. Stack was Python and FastAPI for the API, Redis for the queue, Helm charts for deploys, Prometheus and Grafana for monitoring. (your words: “Stack: Python and FastAPI for the API, Redis for the queue, Helm charts for deploys, Prometheus and Grafana for monitoring.”)
6. We used Kubernetes Jobs with a scheduler extender instead of Slurm, because the department wanted containers and we needed per-course GPU quotas. (your words: “we used Kubernetes Jobs with a scheduler extender instead of Slurm, because the department wanted everything in containers and we needed per-course GPU quotas”)
7. In week 9 jobs started dying at random, pods OOMKilled even with tiny models. (your words: “in week 9 jobs started dying at random, pods OOMKilled even with tiny models”)
10. Sam wrote the Helm patch. I reproduced the failure, tested his fix and wrote the incident notes. (your words: “Sam wrote the Helm patch. I reproduced the failure, tested his fix and wrote the incident notes.”)
11. Fixed it by mounting a memory-backed emptyDir with a size limit per job. (your words: “Fixed it by mounting a memory-backed emptyDir with a size limit per job.”)
12. I liked the infrastructure side more than the machine learning side, and Graphcore builds both the hardware and the cloud platform. (your words: “I liked the infrastructure side of the project more than the machine learning side, and Graphcore builds both the hardware and the cloud platform that models run on.”)

## Still to do on the employer’s site

- [ ] First Name
- [ ] Last Name
- [ ] Email
- [ ] Phone
- [ ] Resume/CV
- [ ] Do you have the legal right to work in the UK without sponsorship?
- [ ] Have you added your full legal name and surname (including any middle names)?
- [ ] What is your predicted/final degree classification?
- [ ] Please note this opportunity is based in our Bristol, UK office. Please confirm you are happy to proceed on this basis.
- [ ] Would you need to relocate to work regularly from this office?
- [ ] How did you first hear about Graphcore?
- [ ] Please select your right to work status
