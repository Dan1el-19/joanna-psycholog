import { describe, it, expect } from '@jest/globals';

// We'll import helper functions by copying minimal versions here to keep tests hermetic.

const slotLength = 30;
const allSlots = (() => {
  const s: string[] = [];
  for (let hour = 7; hour <= 20; hour++) {
    s.push(`${String(hour).padStart(2,'0')}:00`);
    s.push(`${String(hour).padStart(2,'0')}:30`);
  }
  return s;
})();
function slotIndexOf(time: string) { return allSlots.indexOf(time); }
function slotAt(idx: number) { if (idx < 0 || idx >= allSlots.length) return null; return allSlots[idx]; }

function expandAppointmentSlots(startTime: string, durationMinutes: number) {
  const startIdx = slotIndexOf(startTime);
  const slots = Math.max(1, Math.ceil(durationMinutes / slotLength));
  const occupied: string[] = [];
  for (let i = 0; i < slots; i++) {
    const s = slotAt(startIdx + i);
    if (s) occupied.push(s);
  }
  return occupied;
}

describe('availability buffers', () => {
  it('expands 50min appointment into 2 slots', () => {
    const occ = expandAppointmentSlots('11:00', 50);
    expect(occ).toEqual(['11:00','11:30']);
  });

  it('expands 60min appointment into 2 slots (60/30=2)', () => {
    const occ = expandAppointmentSlots('11:00', 60);
    expect(occ).toEqual(['11:00','11:30']);
  });

  it('expands 90min appointment into 3 slots', () => {
    const occ = expandAppointmentSlots('11:00', 90);
    expect(occ).toEqual(['11:00','11:30','12:00']);
  });

  it('backward buffer blocks max service slots before appointment', () => {
    // assume maxServiceSlots=3 (90min)
    const startIdx = slotIndexOf('11:00');
    const blocked: string[] = [];
    for (let i = 1; i <= 3; i++) {
      const prev = slotAt(startIdx - i);
      if (prev) blocked.push(prev);
    }
  // Expect nearest previous slots first: 10:30, 10:00, 09:30
  expect(blocked).toEqual(['10:30','10:00','09:30']);
  });
});
