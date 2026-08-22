-- Newer Supabase projects apply least-privilege defaults: service_role no
-- longer receives data privileges on tables created by migrations. This app's
-- server actions run exclusively through the service-role admin client, so
-- grant it data access explicitly — for every existing table and, via default
-- privileges, for tables future migrations create.
grant usage on schema public to service_role;

grant select, insert, update, delete
  on all tables in schema public
  to service_role;

alter default privileges in schema public
  grant select, insert, update, delete on tables to service_role;
