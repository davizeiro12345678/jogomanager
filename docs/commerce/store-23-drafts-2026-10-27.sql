-- 23 optional bundles and utility packs. Draft only: never expose a SKU
-- until the corresponding Stripe live Price is checked, fulfillment tested,
-- and checkout changes pass CI. These rows cannot be purchased while inactive.
INSERT INTO public.store_products
  (key,name,description,price_cents,currency,coins,kind,active,stripe_lookup_key,contents)
VALUES
  ('coins_micro', 'Moedas de apoio', '100 moedas para compras pequenas e personalizações.', 290, 'BRL', 100, 'coins', false, 'coins_micro', '{"coins":100,"scoutReports":0,"trainingBoosts":0,"themes":[]}'::jsonb),
  ('coins_750', 'Bolsa de 750 moedas', '750 moedas para a carteira da carreira.', 690, 'BRL', 750, 'coins', false, 'coins_750', '{"coins":750,"scoutReports":0,"trainingBoosts":0,"themes":[]}'::jsonb),
  ('coins_1200', 'Reserva de 1.200 moedas', '1.200 moedas para usar nos recursos do jogo.', 990, 'BRL', 1200, 'coins', false, 'coins_1200', '{"coins":1200,"scoutReports":0,"trainingBoosts":0,"themes":[]}'::jsonb),
  ('coins_2500', 'Caixa de 2.500 moedas', '2.500 moedas adicionadas à carteira.', 1890, 'BRL', 2500, 'coins', false, 'coins_2500', '{"coins":2500,"scoutReports":0,"trainingBoosts":0,"themes":[]}'::jsonb),
  ('coins_3500', 'Tesouro de 3.500 moedas', '3.500 moedas creditadas à carteira.', 2490, 'BRL', 3500, 'coins', false, 'coins_3500', '{"coins":3500,"scoutReports":0,"trainingBoosts":0,"themes":[]}'::jsonb),
  ('coins_6000', 'Cofre de 6.000 moedas', '6.000 moedas para várias temporadas.', 3990, 'BRL', 6000, 'coins', false, 'coins_6000', '{"coins":6000,"scoutReports":0,"trainingBoosts":0,"themes":[]}'::jsonb),
  ('coins_10000', 'Reserva de 10.000 moedas', '10.000 moedas adicionadas à carteira.', 5990, 'BRL', 10000, 'coins', false, 'coins_10000', '{"coins":10000,"scoutReports":0,"trainingBoosts":0,"themes":[]}'::jsonb),
  ('scout_3', 'Olheiro de estreia', '3 relatórios de observação de jogadores.', 390, 'BRL', 0, 'scout', false, 'scout_3', '{"coins":0,"scoutReports":3,"trainingBoosts":0,"themes":[]}'::jsonb),
  ('scout_20', 'Olheiro regional', '20 relatórios de observação de jogadores.', 790, 'BRL', 0, 'scout', false, 'scout_20', '{"coins":0,"scoutReports":20,"trainingBoosts":0,"themes":[]}'::jsonb),
  ('scout_35', 'Olheiro nacional', '35 relatórios de observação de jogadores.', 1190, 'BRL', 0, 'scout', false, 'scout_35', '{"coins":0,"scoutReports":35,"trainingBoosts":0,"themes":[]}'::jsonb),
  ('scout_60', 'Olheiro internacional', '60 relatórios de observação de jogadores.', 1790, 'BRL', 0, 'scout', false, 'scout_60', '{"coins":0,"scoutReports":60,"trainingBoosts":0,"themes":[]}'::jsonb),
  ('scout_100', 'Central de observação', '100 relatórios de observação de jogadores.', 2490, 'BRL', 0, 'scout', false, 'scout_100', '{"coins":0,"scoutReports":100,"trainingBoosts":0,"themes":[]}'::jsonb),
  ('training_2', 'Dois impulsos de treino', '2 créditos de impulso de treino.', 390, 'BRL', 0, 'training', false, 'training_2', '{"coins":0,"scoutReports":0,"trainingBoosts":2,"themes":[]}'::jsonb),
  ('training_5', 'Semana de treino', '5 créditos de impulso de treino.', 790, 'BRL', 0, 'training', false, 'training_5', '{"coins":0,"scoutReports":0,"trainingBoosts":5,"themes":[]}'::jsonb),
  ('training_10', 'Ciclo de treino', '10 créditos de impulso de treino.', 1290, 'BRL', 0, 'training', false, 'training_10', '{"coins":0,"scoutReports":0,"trainingBoosts":10,"themes":[]}'::jsonb),
  ('training_20', 'Preparação prolongada', '20 créditos de impulso de treino.', 2190, 'BRL', 0, 'training', false, 'training_20', '{"coins":0,"scoutReports":0,"trainingBoosts":20,"themes":[]}'::jsonb),
  ('training_40', 'Centro de treinamento', '40 créditos de impulso de treino.', 3490, 'BRL', 0, 'training', false, 'training_40', '{"coins":0,"scoutReports":0,"trainingBoosts":40,"themes":[]}'::jsonb),
  ('bundle_starter', 'Kit de estreia', '500 moedas, 5 relatórios de olheiros e 2 impulsos de treino.', 990, 'BRL', 500, 'bundle', false, 'bundle_starter', '{"coins":500,"scoutReports":5,"trainingBoosts":2,"themes":[]}'::jsonb),
  ('bundle_derby', 'Preparação para clássico', '750 moedas, 10 relatórios de olheiros e 5 impulsos de treino.', 1490, 'BRL', 750, 'bundle', false, 'bundle_derby', '{"coins":750,"scoutReports":10,"trainingBoosts":5,"themes":[]}'::jsonb),
  ('bundle_academy', 'Olhar para a base', '350 moedas, 20 relatórios de olheiros e 3 impulsos de treino.', 1390, 'BRL', 350, 'bundle', false, 'bundle_academy', '{"coins":350,"scoutReports":20,"trainingBoosts":3,"themes":[]}'::jsonb),
  ('bundle_market', 'Mercado de transferências', '1.000 moedas, 15 relatórios de olheiros e 2 impulsos de treino.', 1890, 'BRL', 1000, 'bundle', false, 'bundle_market', '{"coins":1000,"scoutReports":15,"trainingBoosts":2,"themes":[]}'::jsonb),
  ('bundle_manager_pro', 'Kit técnico avançado', '3.000 moedas, 30 relatórios de olheiros e 10 impulsos de treino.', 3490, 'BRL', 3000, 'bundle', false, 'bundle_manager_pro', '{"coins":3000,"scoutReports":30,"trainingBoosts":10,"themes":[]}'::jsonb),
  ('bundle_manager_plus', 'Kit carreira completa', '6.000 moedas, 70 relatórios de olheiros e 30 impulsos de treino.', 5990, 'BRL', 6000, 'bundle', false, 'bundle_manager_plus', '{"coins":6000,"scoutReports":70,"trainingBoosts":30,"themes":[]}'::jsonb)
ON CONFLICT (key) DO NOTHING;
