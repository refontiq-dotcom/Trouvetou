# -*- coding: utf-8 -*-
"""Petite bibliothèque de patch : remplacements de texte exacts, fins de ligne
préservées fichier par fichier (le dépôt est mixte CRLF/LF)."""

import io
import os
import sys

OPS = []


def op(path, old, new):
    OPS.append((path, old, new))


def op_all(path, old, new):
    """Remplace TOUTES les occurrences de `old`."""
    OPS.append((path, "__all__", (old, new)))


def op_lines(path, start, end, new):
    """Remplace les lignes `start`..`end` (1-based, bornes incluses)."""
    OPS.append((path, "__lines__", (start, end, new)))


def _newline_of(path):
    if not os.path.exists(path):
        return "\n"
    data = open(path, "rb").read()
    crlf = data.count(b"\r\n")
    lf = data.count(b"\n") - crlf
    if crlf and not lf:
        return "\r\n"
    return "\n"


def _convert(text, nl):
    return text.replace("\r\n", "\n").replace("\n", nl)


def apply():
    failed = False
    for path, old, new in OPS:
        nl = _newline_of(path)
        if os.path.exists(path):
            content = io.open(path, encoding="utf-8", newline="").read()
        else:
            content = ""
        if old == "__all__":
            needle, replacement = new
            o = _convert(needle, nl)
            if o not in content:
                print("NOT FOUND (all): %s" % path)
                print(repr(o[:300]))
                failed = True
                continue
            content = content.replace(o, _convert(replacement, nl))
        elif old == "__lines__":
            start, end, replacement = new
            lines = content.split(nl)
            head = lines[: start - 1]
            tail = lines[end:]
            replacement_lines = _convert(replacement, nl).split(nl)
            if replacement_lines and replacement_lines[-1] == "":
                replacement_lines = replacement_lines[:-1]
            content = nl.join(head + replacement_lines + tail)
        elif old:
            needle = _convert(old, nl)
            if needle not in content:
                print("NOT FOUND: %s" % path)
                print(repr(needle[:300]))
                failed = True
                continue
            content = content.replace(needle, _convert(new, nl), 1)
        else:
            content = _convert(new, nl)
        io.open(path, "w", encoding="utf-8", newline="").write(content)
        print("OK %s" % path)
    if failed:
        sys.exit(1)
