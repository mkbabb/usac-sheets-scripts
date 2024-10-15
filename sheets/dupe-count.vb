=ARRAYFORMULA(
  LET(
    key_range, AZ2:BI,
    keys, REDUCE("", SEQUENCE(COLUMNS(key_range)), LAMBDA(acc, col, acc & INDEX(key_range, 0, col))),
    unique_keys, UNIQUE(keys),
    counts, COUNTIFS(keys, unique_keys),
    VLOOKUP(keys, {unique_keys, counts}, 2, FALSE)
  )
)