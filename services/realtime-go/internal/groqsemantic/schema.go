package groqsemantic

func semanticSchema() map[string]any {
	return map[string]any{
		"type":                 "object",
		"additionalProperties": false,

		"properties": map[string]any{
			"observations": map[string]any{
				"type": "array",

				"items": map[string]any{
					"type":                 "object",
					"additionalProperties": false,

					"properties": map[string]any{
						"kind": map[string]any{
							"type": "string",

							"enum": []string{
								"unknown",
								"proposal",
								"decision",
								"commitment",
								"question",
							},
						},

						"summary": map[string]any{
							"type": "string",
						},

						"owner": map[string]any{
							"type": "string",
						},

						"dueText": map[string]any{
							"type": "string",
						},

						"explicit": map[string]any{
							"type": "boolean",
						},

						"confidence": map[string]any{
							"type":    "number",
							"minimum": 0,
							"maximum": 1,
						},
					},

					"required": []string{
						"kind",
						"summary",
						"owner",
						"dueText",
						"explicit",
						"confidence",
					},
				},
			},
		},

		"required": []string{
			"observations",
		},
	}
}
