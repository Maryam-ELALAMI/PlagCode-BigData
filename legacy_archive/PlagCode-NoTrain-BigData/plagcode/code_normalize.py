from __future__ import annotations
import ast
import io
import tokenize
from dataclasses import dataclass
from typing import List, Tuple, Dict, Any

@dataclass
class NormalizedCode:
    normalized_text: str
    tokens: List[str]
    token_spans: List[Tuple[int, int]]  # (start_line, end_line)
    ast_bag: Dict[str, int]

def _tokenize_python(code: str) -> Tuple[List[str], List[Tuple[int,int]]]:
    toks: List[str] = []
    spans: List[Tuple[int,int]] = []
    reader = io.BytesIO(code.encode("utf-8", errors="ignore")).readline
    for tok in tokenize.tokenize(reader):
        if tok.type in (tokenize.ENCODING, tokenize.NL, tokenize.NEWLINE, tokenize.ENDMARKER, tokenize.INDENT, tokenize.DEDENT):
            continue
        if tok.type == tokenize.COMMENT:
            continue
        val = tok.string
        if tok.type == tokenize.NAME:
            # keep keywords, normalize identifiers
            if val in tokenize.tok_name.values():
                pass
            # python keywords are NAME tokens; detect via keyword module
        toks.append((tok.type, val, tok.start[0], tok.end[0]))
    # second pass for normalization with keyword detection
    import keyword
    norm_tokens: List[str] = []
    norm_spans: List[Tuple[int,int]] = []
    name_map: Dict[str,str] = {}
    var_i = 0
    func_i = 0

    for ttype, val, sline, eline in toks:
        if ttype == tokenize.NAME:
            if keyword.iskeyword(val):
                norm = val
            else:
                if val not in name_map:
                    # simple heuristic: function names often followed by "(" in raw stream,
                    # but tokenize doesn't provide lookahead easily; keep one pool.
                    var_i += 1
                    name_map[val] = f"ID_{var_i}"
                norm = name_map[val]
        elif ttype == tokenize.NUMBER:
            norm = "NUM"
        elif ttype == tokenize.STRING:
            norm = "STR"
        else:
            norm = val
        norm_tokens.append(norm)
        norm_spans.append((sline, eline))
    return norm_tokens, norm_spans

def _ast_bag(code: str) -> Dict[str,int]:
    bag: Dict[str,int] = {}
    try:
        tree = ast.parse(code)
    except Exception:
        return bag
    for node in ast.walk(tree):
        name = type(node).__name__
        bag[name] = bag.get(name, 0) + 1
    return bag

def normalize_python(code: str) -> NormalizedCode:
    tokens, spans = _tokenize_python(code)
    normalized_text = " ".join(tokens)
    bag = _ast_bag(code)
    return NormalizedCode(normalized_text=normalized_text, tokens=tokens, token_spans=spans, ast_bag=bag)
