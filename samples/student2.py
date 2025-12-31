# Same logic, different names + formatting
def fibonacci(x):
    first = 0
    second = 1
    for i in range(x):
        first, second = second, first + second
    return first

print([fibonacci(i) for i in range(10)])
