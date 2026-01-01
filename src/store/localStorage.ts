import type { Case } from '../types/case';
const CASES_KEY = 'noclense_cases';
export function saveCases(cases: Case[]): void { try { localStorage.setItem(CASES_KEY, JSON.stringify(cases)); } catch (e) { console.error('Failed to save cases:', e); } }
export function loadCases(): Case[] { try { const data = localStorage.getItem(CASES_KEY); return data ? JSON.parse(data) : []; } catch (e) { console.error('Failed to load cases:', e); return []; } }
