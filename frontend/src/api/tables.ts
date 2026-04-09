import { apiPost, apiPut } from './client'

export function insertRow(tableName: string, data: Record<string, unknown>): Promise<{ id: number }> {
  return apiPost(`/api/tables/${tableName}`, data)
}

export function updateRow(tableName: string, id: number, data: Record<string, unknown>): Promise<void> {
  return apiPut(`/api/tables/${tableName}/${id}`, data)
}

export function submitDonation(amountUsd: number, note?: string): Promise<{ donationId: number; supporterId: number; amountPhp: number }> {
  return apiPost('/api/donations/submit', { amountUsd, note })
}
