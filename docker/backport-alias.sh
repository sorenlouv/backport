backport() {
    BACKPORT_FOLDER=~/.backport

    # -it: interactive shell
    # --rm: remove container after exit
    # -v: mount current directory as read-only volume in container (to access .backportrc.json)
    # -v: mount backport folder in container (to access config.json and avoid re-cloning repos)
    # "$@": pass all bash arguments to docker (which into turn passes them to backport cli inside container)
    docker run -it --rm -v $(pwd):/app:ro -v $BACKPORT_FOLDER:/root/.backport backport-im "$@"
}
