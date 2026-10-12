-- Run against STAGING through scripts/staging-anonymize.sh, never directly:
-- both databases are called `papermarket`, and only the script checks the
-- container. Rolls back unless `apply` is true.
--
-- Replaces every person's identifying details in staging's copy of production
-- with random ones, so it can be used without holding real users' data:
--   "user"        email (random local part, domain kept so the institution
--                 allowlist still matches), name, image
--   accounts      handle, display_name, orcid, ror_id
--   affiliations  email, same local part as the login, domain kept
--   account       credentials deleted: password hashes are personal too
--   rate_limit_buckets  every key naming an address
-- Untouched: bots and house accounts (operator-made, nothing personal), the
-- addresses in :keep (ADMIN_EMAILS, so staging's admin can still sign in), and
-- what people wrote themselves (comment bodies, group names), which is public
-- on production anyway. institutions stay: they drive the boards under test.
--
-- Staging sends no mail, so nobody can sign in as a randomised user afterwards.

begin;

create temp table anon on commit drop as
select u.id as user_id,
       'anon-' || substr(md5(random()::text || u.id), 1, 10) as local,
       'trader-' || substr(md5(random()::text || u.id), 1, 8) as handle,
       (array['Ada', 'Alan', 'Amara', 'Bea', 'Chen', 'Dara', 'Elif', 'Emil', 'Farah', 'Giulia', 'Hana', 'Ines',
              'Jonas', 'Kofi', 'Lena', 'Mateo', 'Mira', 'Noor', 'Omar', 'Priya', 'Quinn', 'Ravi', 'Sofia',
              'Tariq', 'Uma', 'Viktor', 'Wen', 'Yara', 'Yusuf', 'Zoe'])[1 + floor(random() * 30)::int]
       || ' ' ||
       (array['Abbott', 'Bauer', 'Castillo', 'Dubois', 'Eriksen', 'Fischer', 'Garcia', 'Haddad', 'Ito', 'Jansen',
              'Kowalski', 'Lindqvist', 'Moreau', 'Nakamura', 'Okafor', 'Petrov', 'Quist', 'Rossi', 'Sato',
              'Tanaka', 'Usman', 'Varga', 'Weber', 'Xu', 'Yilmaz', 'Zhang', 'Novak', 'Silva', 'Kim', 'Brennan'])
       [1 + floor(random() * 30)::int] as name
from "user" u
where lower(u.email) <> all (string_to_array(:'keep', ','))
  and u.email not like '%@bots.papermarket.invalid'
  and not exists (select 1 from accounts a where a.user_id = u.id and (a.is_bot or a.is_house));

-- An account still showing its trader-xxxx placeholder keeps one, and a user
-- who never gave a name (blank, which asks for one) stays blank.
update accounts a
set handle = n.handle,
    display_name = case when a.display_name = a.handle then n.handle else n.name end,
    orcid = null,
    ror_id = null
from anon n
where a.user_id = n.user_id;

update affiliations f
set email = n.local || '@' || split_part(f.email, '@', 2)
from accounts a
join anon n on n.user_id = a.user_id
where f.account_id = a.id;

update "user" u
set email = n.local || '@' || split_part(lower(u.email), '@', 2),
    name = case when u.name = '' then '' else n.name end,
    image = null
from anon n
where u.id = n.user_id;

delete from account where user_id in (select user_id from anon);
delete from rate_limit_buckets where key like '%@%';

select (select count(*) from anon) as users_randomised,
       (select count(*) from "user" u
         where u.email not like 'anon-%'
           and u.email not like '%@bots.papermarket.invalid'
           and lower(u.email) <> all (string_to_array(:'keep', ','))
           and not exists (select 1 from accounts a where a.user_id = u.id and (a.is_bot or a.is_house))) as users_left,
       (select count(*) from affiliations f
         join accounts a on a.id = f.account_id
         join anon n on n.user_id = a.user_id
         where f.email not like 'anon-%') as affiliations_left,
       (select count(*) from account a join anon n on n.user_id = a.user_id) as credentials_left;

\if :apply
commit;
\echo 'Applied.'
\else
rollback;
\echo 'Dry run: rolled back. Re-run with --apply to keep it.'
\endif
