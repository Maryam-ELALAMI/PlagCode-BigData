from plagcode.code_normalize import normalize_python
from plagcode.fingerprinting import winnow, jaccard

def test_winnow_jaccard_high_for_renaming():
    a = "def f(n):\n a=0\n b=1\n for _ in range(n):\n  a,b=b,a+b\n return a\n"
    b = "def fib(x):\n first=0\n second=1\n for i in range(x):\n  first,second=second,first+second\n return first\n"
    na = normalize_python(a)
    nb = normalize_python(b)
    fa = set(h for _,h in winnow(na.tokens, k=10, window=4))
    fb = set(h for _,h in winnow(nb.tokens, k=10, window=4))
    assert jaccard(fa, fb) > 0.2
