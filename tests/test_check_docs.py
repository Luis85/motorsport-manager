"""Adverse fixtures for the local documentation checker."""

from __future__ import annotations

import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from check_docs import anchors, check


class DocumentationChecks(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.write("docs/README.md", "# Docs\n\n[Guide](how-to/guide.md#save--resume)\n")
        self.write("docs/how-to/guide.md", "# Guide\n\n## Save & resume\n")

    def write(self, name, value):
        path = self.root / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(value, encoding="utf-8")

    def test_valid_links_and_fenced_examples(self):
        with (self.root / "docs/README.md").open("a") as file:
            file.write("\n```md\n[Example](missing.md)\n```\n[Web](https://example.org)\n")
        self.assertEqual(check(self.root), ([], 1))

    def test_missing_target_and_fragment(self):
        self.write("docs/README.md", "[Missing](no.md)\n[Section](how-to/guide.md#wrong)\n")
        errors, _ = check(self.root)
        self.assertTrue(any("missing link target no.md" in error for error in errors))
        self.assertTrue(any("missing heading fragment" in error for error in errors))

    def test_encoded_path_reference_definition_and_duplicate_heading(self):
        self.write("docs/README.md", "[See][guide]\n\n[guide]: <how-to/two words.md#repeat-1>\n")
        self.write("docs/how-to/two words.md", "# Repeat\n## Repeat\n[Other](guide.md)\n")
        errors, count = check(self.root)
        self.assertEqual(errors, [])
        self.assertEqual(count, 2)
        self.assertEqual(anchors("# Repeat\n## Repeat\n"), {"repeat", "repeat-1"})

    def test_unindexed_page_and_root_document(self):
        self.write("docs/loose.md", "# Loose\n")
        errors, _ = check(self.root)
        self.assertTrue(any("root permits only" in error for error in errors))
        self.assertTrue(any("loose.md: unreachable" in error for error in errors))

    def test_archive_requires_historical_notice(self):
        self.write("docs/_archive/old.md", "# Old\n")
        self.write("docs/README.md", "[Old](_archive/old.md)\n[Guide](how-to/guide.md)\n")
        errors, _ = check(self.root)
        self.assertTrue(any("missing explicit historical notice" in error for error in errors))
        self.write("docs/_archive/old.md", "# Old\n\n> **Historical record.**\n")
        self.assertEqual(check(self.root)[0], [])

    def test_stale_production_document_path(self):
        self.write("scripts/diagnostic.gd", 'var help = "See docs/old.md"\n')
        errors, _ = check(self.root)
        self.assertTrue(any("stale document path docs/old.md" in error for error in errors))

    def test_installed_dependency_docs_are_not_authored_pages(self):
        self.write(
            "docs/concepts/example/node_modules/package/README.md",
            "[Missing](missing.md)\nSee docs/old.md.\n",
        )
        self.assertEqual(check(self.root), ([], 1))

    def test_other_nested_docs_and_dependency_links_remain_checked(self):
        self.write("docs/concepts/example/vendor/README.md", "[Missing](missing.md)\n")
        self.write("docs/concepts/example/node_modules-not/README.md", "# Authored\n")
        with (self.root / "docs/how-to/guide.md").open("a") as file:
            file.write("[Dependency](../concepts/example/node_modules/package/missing.md)\n")
        errors, _ = check(self.root)
        self.assertTrue(any("vendor/README.md:1: missing link" in error for error in errors))
        self.assertTrue(any("vendor/README.md: unreachable" in error for error in errors))
        self.assertTrue(any("node_modules-not/README.md: unreachable" in error for error in errors))
        self.assertTrue(
            any(
                "missing link target ../concepts/example/node_modules/" in error for error in errors
            )
        )

    def test_generated_artifact_glob_does_not_exempt_literal_documents(self):
        self.write(
            ".github/workflows/example.yml",
            "path: |\n"
            "  docs/concepts/littlewild/verification/v15/*click-diagnostics.json\n"
            "  docs/concepts/littlewild/verification/v15/*gate-results.json\n"
            "  docs/concepts/littlewild/verification/v15/*building-interiors-browser.json\n",
        )
        self.assertEqual(check(self.root), ([], 1))
        with (self.root / "docs/how-to/guide.md").open("a") as file:
            file.write(
                "See docs/concepts/littlewild/verification/v15/storytelling-click-diagnostics.json.\n"
            )
        errors, _ = check(self.root)
        self.assertTrue(
            any(
                "stale document path docs/concepts/littlewild/verification/v15/" in error
                for error in errors
            )
        )


if __name__ == "__main__":
    unittest.main()
