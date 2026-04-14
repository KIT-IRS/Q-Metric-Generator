public static class ValueIntentionValidator
{
    // Each key maps to the states it CAN transition to — mirrors frontend config
    public static readonly Dictionary<string, List<string>> AllowedTransitions = new()
    {
        { "null/empty",   new() { "generated", "placeholder", "default", "hypothetical", "invalid" } },
        { "generated",    new() { "actual", "placeholder", "default", "outdated", "hypothetical", "null/empty" } },
        { "placeholder",  new() { "generated", "default", "null/empty" } },
        { "default",      new() { "generated", "actual", "outdated", "hypothetical", "invalid", "null/empty" } },
        { "hypothetical", new() { "generated", "actual", "default", "null/empty" } },
        { "invalid",   new() { "generated", "actual", "null/empty" } },
        { "actual",       new() { "outdated", "null/empty" } },
        { "outdated",     new() { "generated", "null/empty" } },
    };

    public static string? Validate(string currentState, string newState)
    {
        if (currentState == newState)
            return null; // no-op is always valid

        if (!AllowedTransitions.TryGetValue(currentState, out var allowed))
            return $"Unknown current intent_semantics state: '{currentState}'";

        if (!allowed.Contains(newState))
            return $"Transition from '{currentState}' to '{newState}' is not allowed. Allowed: {string.Join(", ", allowed)}";

        return null;
    }
}
