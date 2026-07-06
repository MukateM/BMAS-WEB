from __future__ import annotations

import argparse
from pathlib import Path

import fitz
from PIL import Image


def render_pdf_pages(input_pdf: Path, output_dir: Path, width: int, quality: int) -> None:
    output_dir.mkdir(parents=True, exist_ok=True)
    document = fitz.open(input_pdf)

    for page_index in range(document.page_count):
      page = document.load_page(page_index)
      rect = page.rect
      zoom = width / rect.width
      matrix = fitz.Matrix(zoom, zoom)
      pixmap = page.get_pixmap(matrix=matrix, alpha=False)
      image = Image.frombytes("RGB", (pixmap.width, pixmap.height), pixmap.samples)
      output_path = output_dir / f"page-{page_index + 1:03d}.jpg"
      image.save(output_path, "JPEG", quality=quality, optimize=True, progressive=True)
      print(f"Saved {output_path}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Render each PDF page as a full-page JPEG.")
    parser.add_argument("input_pdf", type=Path)
    parser.add_argument("output_dir", type=Path)
    parser.add_argument("--width", type=int, default=1500)
    parser.add_argument("--quality", type=int, default=84)
    args = parser.parse_args()

    render_pdf_pages(
        input_pdf=args.input_pdf,
        output_dir=args.output_dir,
        width=args.width,
        quality=args.quality,
    )


if __name__ == "__main__":
    main()
