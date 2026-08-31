import type {
  InformationRequest,
  OccurrenceComplement
} from "../../generated/prisma/client.js"

export function toInformationRequestDto(request: InformationRequest) {
  return {
    id: request.id,
    message: request.message,
    status: request.status,
    createdAt: request.createdAt,
    answeredAt: request.answeredAt
  }
}

export function toComplementDto(complement: OccurrenceComplement) {
  return {
    id: complement.id,
    occurrenceId: complement.occurrenceId,

    requestId: complement.requestId,

    text: complement.text,

    createdAt: complement.createdAt
  }
}
