from __future__ import annotations

import argparse
import hashlib
from dataclasses import asdict, dataclass
from pathlib import Path

import pandas as pd
from PIL import Image, UnidentifiedImageError


SUPPORTED_EXTENSIONS = {
    ".jpg",
    ".jpeg",
    ".png",
    ".webp",
    ".bmp",
    ".tif",
    ".tiff",
}


@dataclass
class ImageRecord:
    image_id: str

    source_dataset: str

    relative_path: str

    filename: str

    extension: str

    file_size_bytes: int

    sha256: str

    width: int | None

    height: int | None

    image_format: str | None

    image_mode: str | None

    valid_image: bool

    error: str | None


def calculate_sha256(
    file_path: Path,
    chunk_size: int = 1024 * 1024,
) -> str:
    digest = hashlib.sha256()

    with file_path.open("rb") as file:
        while True:
            chunk = file.read(chunk_size)

            if not chunk:
                break

            digest.update(chunk)

    return digest.hexdigest()


def inspect_image(
    *,
    file_path: Path,
    raw_cv_root: Path,
    source_dataset: str,
) -> ImageRecord:
    relative_path = file_path.relative_to(
        raw_cv_root
    ).as_posix()

    sha256 = calculate_sha256(
        file_path
    )

    image_id = sha256

    try:
        with Image.open(file_path) as image:
            image.verify()

        with Image.open(file_path) as image:
            width, height = image.size

            image_format = image.format

            image_mode = image.mode

        return ImageRecord(
            image_id=image_id,

            source_dataset=source_dataset,

            relative_path=relative_path,

            filename=file_path.name,

            extension=file_path.suffix.lower(),

            file_size_bytes=file_path.stat().st_size,

            sha256=sha256,

            width=width,

            height=height,

            image_format=image_format,

            image_mode=image_mode,

            valid_image=True,

            error=None,
        )

    except (
        UnidentifiedImageError,
        OSError,
        ValueError,
    ) as error:
        return ImageRecord(
            image_id=image_id,

            source_dataset=source_dataset,

            relative_path=relative_path,

            filename=file_path.name,

            extension=file_path.suffix.lower(),

            file_size_bytes=file_path.stat().st_size,

            sha256=sha256,

            width=None,

            height=None,

            image_format=None,

            image_mode=None,

            valid_image=False,

            error=str(error),
        )


def discover_images(
    dataset_root: Path,
) -> list[Path]:
    return sorted(
        file_path
        for file_path in dataset_root.rglob("*")
        if (
            file_path.is_file()
            and file_path.suffix.lower()
            in SUPPORTED_EXTENSIONS
        )
    )


def build_inventory(
    raw_cv_root: Path,
) -> pd.DataFrame:
    records: list[ImageRecord] = []

    dataset_directories = sorted(
        path
        for path in raw_cv_root.iterdir()
        if path.is_dir()
    )

    for dataset_root in dataset_directories:
        source_dataset = dataset_root.name

        image_paths = discover_images(
            dataset_root
        )

        print(
            f"[{source_dataset}] "
            f"{len(image_paths)} arquivo(s) de imagem encontrado(s)"
        )

        for index, file_path in enumerate(
            image_paths,
            start=1,
        ):
            record = inspect_image(
                file_path=file_path,

                raw_cv_root=raw_cv_root,

                source_dataset=source_dataset,
            )

            records.append(record)

            if index % 1000 == 0:
                print(
                    f"[{source_dataset}] "
                    f"{index}/{len(image_paths)} processadas"
                )

    dataframe = pd.DataFrame(
        asdict(record)
        for record in records
    )

    if dataframe.empty:
        return dataframe

    dataframe["duplicate_by_sha256"] = (
        dataframe.duplicated(
            subset=["sha256"],
            keep=False,
        )
    )

    dataframe["duplicate_count"] = (
        dataframe.groupby(
            "sha256"
        )["sha256"]
        .transform("size")
    )

    return dataframe


def print_summary(
    dataframe: pd.DataFrame,
) -> None:
    print()

    if dataframe.empty:
        print(
            "Nenhuma imagem encontrada."
        )

        return

    total = len(dataframe)

    valid = int(
        dataframe[
            "valid_image"
        ].sum()
    )

    invalid = total - valid

    duplicated_files = int(
        dataframe[
            "duplicate_by_sha256"
        ].sum()
    )

    unique_hashes = int(
        dataframe[
            "sha256"
        ].nunique()
    )

    print("Resumo")
    print("------")

    print(
        f"Arquivos encontrados: {total}"
    )

    print(
        f"Imagens válidas:      {valid}"
    )

    print(
        f"Imagens inválidas:    {invalid}"
    )

    print(
        f"Hashes únicos:        {unique_hashes}"
    )

    print(
        "Arquivos envolvidos "
        f"em duplicatas:        {duplicated_files}"
    )

    print()

    print("Por dataset")
    print("-----------")

    summary = (
        dataframe.groupby(
            "source_dataset"
        )
        .agg(
            files=(
                "image_id",
                "size",
            ),

            valid_images=(
                "valid_image",
                "sum",
            ),

            unique_hashes=(
                "sha256",
                "nunique",
            ),
        )
        .reset_index()
    )

    print(
        summary.to_string(
            index=False
        )
    )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Inventaria os datasets brutos "
            "de visão computacional do KAMARA."
        )
    )

    parser.add_argument(
        "--raw-dir",

        type=Path,

        default=Path(
            "ml/data/raw/computer-vision"
        ),

        help=(
            "Diretório contendo os datasets "
            "brutos de visão computacional."
        ),
    )

    parser.add_argument(
        "--output",

        type=Path,

        default=Path(
            "ml/data/interim/"
            "computer-vision/"
            "raw-inventory.csv"
        ),

        help=(
            "Arquivo CSV de inventário "
            "a ser gerado."
        ),
    )

    return parser.parse_args()


def main() -> None:
    args = parse_args()

    raw_cv_root = (
        args.raw_dir.resolve()
    )

    output_path = (
        args.output.resolve()
    )

    if not raw_cv_root.exists():
        raise FileNotFoundError(
            "Diretório de dados brutos "
            f"não encontrado: {raw_cv_root}"
        )

    dataframe = build_inventory(
        raw_cv_root
    )

    output_path.parent.mkdir(
        parents=True,
        exist_ok=True,
    )

    dataframe.to_csv(
        output_path,
        index=False,
    )

    print_summary(
        dataframe
    )

    print()

    print(
        "Inventário salvo em:"
    )

    print(
        output_path
    )


if __name__ == "__main__":
    main()