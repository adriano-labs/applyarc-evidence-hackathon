Final-year group project, four of us, Sept 2025 to March 2026. We built a self-service GPU job runner for the department's machine learning teaching cluster. Students submitted training jobs through a small web form and the runner queued them on Kubernetes (k3s on six old lab workstations with GPUs).

Stack: Python and FastAPI for the API, Redis for the queue, Helm charts for deploys, Prometheus and Grafana for monitoring.

Big decision: we used Kubernetes Jobs with a scheduler extender instead of Slurm, because the department wanted everything in containers and we needed per-course GPU quotas.

Problem: in week 9 jobs started dying at random, pods OOMKilled even with tiny models. Took us three days. Turned out the default /dev/shm in the pods was 64 MB, so the PyTorch data loaders crashed. Fixed it by mounting a memory-backed emptyDir with a size limit per job.

Result: 140 students used it in the spring term and the average wait for a GPU went from about two days (the old sign-up sheet) to under 20 minutes.

Learned: check the node's kernel log first. dmesg showed the OOM kills straight away and we wasted two days before looking.

Why Graphcore: I liked the infrastructure side of the project more than the machine learning side, and Graphcore builds both the hardware and the cloud platform that models run on.
