-- Reference categories only. No default production user or respondent data.
insert into public.issue_categories (name) values ('Roads'),('Water'),('Employment'),('Healthcare'),('Education'),('Sanitation'),('Public transport'),('Electricity') on conflict do nothing;
