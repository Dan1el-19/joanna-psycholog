// Lekka maszyna stanów dla wizyt

export const allowedTransitions = {
  pending: ['confirmed', 'cancelled', 'archived'],
  confirmed: ['pending', 'completed', 'cancelled', 'archived'],
  completed: ['archived'],
  cancelled: ['archived'],
  archived: []
};

/**
 * Zmienia stan wizyty, pilnując allowedTransitions i normalizując pola.
 * @param {object} appointmentData - dane wizyty (z bazy)
 * @param {string} targetState - docelowy status
 * @param {object} [context] - dodatkowe dane (np. kto zmienia, daty)
 * @returns {object} - obiekt update do updateDoc
 */
export function mutateAppointmentState(appointmentData, targetState, context = {}) {
  const from = appointmentData.status;
  if (!allowedTransitions[from] || !allowedTransitions[from].includes(targetState)) {
    throw new Error(`Nieprawidłowa zmiana statusu: ${from} → ${targetState}`);
  }
  const update = { status: targetState, updatedAt: context.now || new Date() };
  // Normalizacja pól
  if (targetState === 'confirmed') {
    update.confirmedDate = appointmentData.confirmedDate || appointmentData.preferredDate;
    update.confirmedTime = appointmentData.confirmedTime || appointmentData.preferredTime;
  } else if (targetState === 'pending') {
    update.confirmedDate = null;
    update.confirmedTime = null;
  }
  if (targetState === 'completed') {
    update.sessionCompleted = true;
    update.sessionCompletedDate = context.now || new Date();
  }
  if (targetState === 'cancelled') {
    update.cancelledAt = context.now || new Date();
    update.cancelledBy = context.cancelledBy || 'system';
    update.cancellationReason = context.reason || '';
  }
  if (targetState === 'archived') {
    update.isArchived = true;
    update.archivedAt = context.now || new Date();
  }
  return update;
}
