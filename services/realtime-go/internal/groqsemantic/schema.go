package groqsemantic

const maxSemanticResponseItems = 16

func semanticSchema() map[string]any {
	return map[string]any{
		"type":                 "object",
		"additionalProperties": false,

		"properties": map[string]any{
			"observations": map[string]any{
				"type":     "array",
				"maxItems": maxSemanticResponseItems,

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

						"refinesPrevious": map[string]any{
							"type": "boolean",
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
						"refinesPrevious",
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
