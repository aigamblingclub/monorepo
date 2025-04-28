# poker state machine

# todo
- big blind raise preflop
- correct determination of hands (missing full house, two pair, straight with king-ace)
- determine on whether to disambiguate check and call, currently we are calling everything call
    - that could facilitate property testing (i.e. check never changes chips, pots or bets)
