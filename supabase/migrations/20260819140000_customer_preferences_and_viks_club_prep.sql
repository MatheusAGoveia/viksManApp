-- Migration: Add customer preferences and Viks Club preparation fields to profiles
-- Date: 2026-08-19

alter table public.profiles
  add column if not exists prefers_silent_service boolean not null default false,
  add column if not exists viks_club_status text not null default 'inactive',
  add column if not exists viks_points_balance integer not null default 0;

-- Constraints for Viks Club fields
alter table public.profiles
  drop constraint if exists profiles_viks_club_status_check;

alter table public.profiles
  add constraint profiles_viks_club_status_check
  check (viks_club_status in ('inactive', 'active', 'paused', 'canceled'));

alter table public.profiles
  drop constraint if exists profiles_viks_points_balance_check;

alter table public.profiles
  add constraint profiles_viks_points_balance_check
  check (viks_points_balance >= 0);
