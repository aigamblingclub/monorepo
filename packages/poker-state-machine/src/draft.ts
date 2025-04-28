const STAGES = [
    {
        stage: Schema.Literal('preflop'),
        community: Schema.Tuple(),
    },
    {
        stage: Schema.Literal('flop'),
        community: Schema.Tuple(CardSchema, CardSchema, CardSchema),
    },
    {
        stage: Schema.Literal('turn'),
        community: Schema.Tuple(CardSchema, CardSchema, CardSchema, CardSchema),
    },
    {
        stage: Schema.Literal('turn'),
        community: Schema.Tuple(CardSchema, CardSchema, CardSchema, CardSchema, CardSchema),
    }
] as const

const LemmeSee = Schema.Union(
    ...STAGES.map(
        ({ stage, community }) => Schema.Struct({
            stage,
            community,
        })
    )
)
