# Using the docker image

### Running backport via docker

```
alias backport='docker run -it --rm -v $(pwd):/app:ro -v ~/.backport:/root/.backport sqren/backport'
backport
```

# Development

### Running from source

```
docker run -it --rm -v $(pwd):/app:ro -v ~/.backport:/root/.backport $(docker build --tag backport-dev -q .)
```

### Build docker image

```
docker build -t sqren/backport .
```

### Test image locally before publishing:

```
docker run -it --rm -v $(pwd):/app:ro -v ~/.backport:/root/.backport sqren/backport --repo backport-org/backport-demo --no-fork
```

### Publish to Docker hub

#### A. Via Github action

Go to the [Docker push action](https://github.com/sqren/backport/actions/workflows/docker-build-and-push.yml) and deploy by clicking "Run workflow".

#### B. Locally

```
docker push sqren/backport
```

Note: this will not produce multi-platform images

## Authenticate with docker hub

```
docker login
```

A personal access token can be created [here](https://hub.docker.com/settings/security)
