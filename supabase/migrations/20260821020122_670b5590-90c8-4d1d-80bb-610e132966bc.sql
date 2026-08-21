insert into public.clint_channel_accounts (id,name,identifier,team_name,type,status,avatar,is_enabled) values
('cb917e86-5876-400f-8faa-bd7a8a230992', 'API Comercial 04', '351966465313', 'Comercial', 'WHATSAPP_OFFICIAL', 'CONNECTED', 'https://file.clint.digital/contact/a4382e81-b571-4583-842b-193f936ea7af.png', true),
('61599304-cfa2-4c67-b038-1831203e0b9d', 'API Comercial 03', '351966464607', 'Comercial', 'WHATSAPP_OFFICIAL', 'CONNECTED', 'https://file.clint.digital/whatsapp/default.svg', true),
('978ef1b8-c3f2-4e0c-a53f-b4e8e34923b3', 'Suporte LLMidia', '351964152355', 'Customer Success', 'WHATSAPP_OFFICIAL', 'CONNECTED', 'https://file.clint.digital/contact/8d9b39c3-002b-4afa-bff0-4e898de1b2c2.png', true),
('f742031a-b621-4f63-b3e3-52447b100067', 'Mariana - Marketing 01', '351918564377', 'Atendimento', 'WHATSAPP_OFFICIAL', 'DISCONNECTED', 'https://file.clint.digital/contact/3ae081a3-ee34-4229-a5bc-80dc4fa6568e.png', false),
('8460ddfb-045e-4ddc-ac51-4d910c1212c5', 'LL - Marketing 02', '351960447454', 'Atendimento', 'WHATSAPP_OFFICIAL', 'CONNECTED', 'https://file.clint.digital/contact/d0f778dc-3afa-46a5-b343-fc97bb01aae9.png', true),
('962e61fd-0c8a-4744-bfb7-0387b7666db9', 'API Marketing 01', '351927593970', 'Atendimento', 'WHATSAPP_OFFICIAL', 'DISCONNECTED', 'https://file.clint.digital/whatsapp/default.svg', false),
('ff26e4ec-c28d-4c3f-b71d-e8752647fbff', 'API Cobranca 01', '351927593896', 'Comercial', 'WHATSAPP_OFFICIAL', 'DISCONNECTED', 'https://file.clint.digital/whatsapp/default.svg', false),
('91602abb-1b23-4be7-b156-41277ee53b13', 'API Comercial 02', '351960447523', 'Comercial', 'WHATSAPP_OFFICIAL', 'CONNECTED', 'https://file.clint.digital/contact/c3d01fed-91cd-4e6d-a523-05383553988e.png', true),
('dd83b6a1-7cd4-402b-ae0c-bd073754ecac', 'API Comercial 01', '351927593883', 'Comercial', 'WHATSAPP_OFFICIAL', 'CONNECTED', 'https://file.clint.digital/contact/1a05275a-e4ac-4000-b9d8-a7c193a5299c.png', true),
('f9ae0b96-b32f-4dcb-8a28-ad667e595f5b', 'Telemovel da Rita', '351924199090', 'Comercial', 'WHATSAPP', 'CANCELLED', 'https://file.clint.digital/436ac18a-c75d-4984-87b7-5838a2ff3fb6/contact/avatar/1407f8b9-8bdc-4552-8cc3-ad48fa7af1f7.png', false),
('a3f7b101-9953-4925-9af7-cf66ab2b0520', 'Telemovel da Gisele', '351968845938', 'Comercial', 'WHATSAPP', 'CANCELLED', 'https://file.clint.digital/436ac18a-c75d-4984-87b7-5838a2ff3fb6/contact/avatar/4e335b9c-35cb-4c9c-8c94-1558e4df375b.png', false)
on conflict (id) do update set name=excluded.name, identifier=excluded.identifier, team_name=excluded.team_name, type=excluded.type, status=excluded.status, avatar=excluded.avatar, updated_at=now();

update public.clint_channel_accounts set is_default = true
where id = 'dd83b6a1-7cd4-402b-ae0c-bd073754ecac'
  and not exists (select 1 from public.clint_channel_accounts where is_default);