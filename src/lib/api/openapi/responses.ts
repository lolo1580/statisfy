export const errorResponse = {
  description: "Requête invalide ou non autorisée.",
  content: {
    "application/json": {
      schema: { $ref: "#/components/schemas/Error" },
    },
  },
} as const;

export const unauthorizedResponse = {
  description: "Jeton absent, invalide ou révoqué.",
  content: {
    "application/json": {
      schema: { $ref: "#/components/schemas/Error" },
    },
  },
} as const;

export const tooManyRequestsResponse = {
  description: "Quota de requêtes dépassé.",
  headers: {
    "Retry-After": {
      description: "Délai d'attente conseillé, en secondes.",
      schema: { type: "integer", example: 60 },
    },
  },
  content: {
    "application/json": {
      schema: { $ref: "#/components/schemas/Error" },
    },
  },
} as const;

export const binaryBody = (description: string) => ({
  required: true,
  description,
  content: {
    "application/octet-stream": {
      schema: { type: "string", format: "binary" },
    },
  },
});
