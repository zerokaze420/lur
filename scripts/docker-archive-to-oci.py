#!/usr/bin/env python3
import argparse
import gzip
import hashlib
import json
import tarfile
from pathlib import Path


def sha256_bytes(data):
    return hashlib.sha256(data).hexdigest()


def read_tar_member(tar, name):
    member = tar.getmember(name)
    fileobj = tar.extractfile(member)
    if fileobj is None:
        raise RuntimeError(f"tar member is not a file: {name}")
    return fileobj.read()


def convert(docker_archive, images_dir, ref_name):
    images_dir.mkdir(parents=True, exist_ok=True)
    blobs_dir = images_dir / "blobs" / "sha256"
    blobs_dir.mkdir(parents=True, exist_ok=True)
    (images_dir / "oci-layout").write_text(
        json.dumps({"imageLayoutVersion": "1.0.0"}, separators=(",", ":"))
    )

    with tarfile.open(docker_archive, "r:*") as docker_tar:
        manifest_list = json.loads(read_tar_member(docker_tar, "manifest.json"))
        if len(manifest_list) != 1:
            raise RuntimeError(
                f"expected one image in docker archive, got {len(manifest_list)}"
            )
        docker_manifest = manifest_list[0]

        config_name = docker_manifest["Config"]
        config_bytes = read_tar_member(docker_tar, config_name)
        config_digest = f"sha256:{sha256_bytes(config_bytes)}"
        (blobs_dir / config_digest.removeprefix("sha256:")).write_bytes(config_bytes)

        layers = []
        for layer_name in docker_manifest["Layers"]:
            layer_bytes = read_tar_member(docker_tar, layer_name)
            compressed = gzip.compress(layer_bytes, compresslevel=9, mtime=0)
            digest = f"sha256:{sha256_bytes(compressed)}"
            diff_digest = f"sha256:{sha256_bytes(layer_bytes)}"
            (blobs_dir / digest.removeprefix("sha256:")).write_bytes(compressed)
            layers.append(
                {
                    "mediaType": "application/vnd.oci.image.layer.v1.tar+gzip",
                    "digest": digest,
                    "size": len(compressed),
                    "annotations": {
                        "org.opencontainers.image.uncompressedDigest": diff_digest
                    },
                }
            )

    oci_manifest = {
        "schemaVersion": 2,
        "mediaType": "application/vnd.oci.image.manifest.v1+json",
        "config": {
            "mediaType": "application/vnd.oci.image.config.v1+json",
            "digest": config_digest,
            "size": len(config_bytes),
        },
        "layers": layers,
    }
    manifest_bytes = json.dumps(oci_manifest, separators=(",", ":")).encode()
    manifest_digest = f"sha256:{sha256_bytes(manifest_bytes)}"
    (blobs_dir / manifest_digest.removeprefix("sha256:")).write_bytes(manifest_bytes)

    index_path = images_dir / "index.json"
    if index_path.exists():
        index = json.loads(index_path.read_text())
    else:
        index = {"schemaVersion": 2, "manifests": []}

    index["manifests"] = [
        entry
        for entry in index.get("manifests", [])
        if entry.get("annotations", {}).get("org.opencontainers.image.ref.name")
        != ref_name
    ]
    index["manifests"].append(
        {
            "mediaType": "application/vnd.oci.image.manifest.v1+json",
            "digest": manifest_digest,
            "size": len(manifest_bytes),
            "annotations": {"org.opencontainers.image.ref.name": ref_name},
        }
    )
    index_path.write_text(json.dumps(index, indent=2) + "\n")

    return {
        "alias": ref_name,
        "image_id": config_digest,
        "manifest_digest": manifest_digest,
        "layers": [layer["digest"] for layer in layers],
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--docker-archive", required=True, type=Path)
    parser.add_argument("--images-dir", required=True, type=Path)
    parser.add_argument("--ref-name", required=True)
    args = parser.parse_args()
    print(json.dumps(convert(args.docker_archive, args.images_dir, args.ref_name)))


if __name__ == "__main__":
    main()
