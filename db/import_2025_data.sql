-- Import Project Data from CSV (2026)
-- This script imports projects and monthly records into the database.
-- Logic refined to support "Project Scoping Per Period".
-- Each project is inserted SPECIFICALLY for a period (e.g., '2026-H1' or '2026-H2').
-- This ensures that projects are independent across periods.

-- Ensure 2026 periods exist
INSERT INTO public.periods (label, year, half) VALUES
('2026-H1', 2026, 'H1'),
('2026-H2', 2026, 'H2')
ON CONFLICT (label) DO NOTHING;

DO $$
DECLARE
  -- H1 Project IDs
  p_h1_isj UUID;
  p_h1_glw UUID;
  p_h1_gnn_kasai UUID;
  p_h1_technohama UUID;
  p_h1_nissen UUID;
  p_h1_vuteq UUID;
  p_h1_gnn_w13g UUID;
  p_h1_keiso UUID;
  p_h1_mobitec UUID;
  p_h1_imazato UUID;
  p_h1_koizumi UUID;
  p_h1_akebono UUID;
  p_h1_new UUID;

  -- H2 Project IDs
  p_h2_isj UUID;
  p_h2_glw UUID;
  p_h2_gnn_kasai UUID;
  p_h2_technohama UUID;
  p_h2_nissen UUID;
  p_h2_vuteq UUID;
  p_h2_gnn_w13g UUID;
  p_h2_keiso UUID;
  p_h2_mobitec UUID;
  p_h2_imazato UUID;
  p_h2_koizumi UUID;
  p_h2_akebono UUID;
  p_h2_new UUID;
BEGIN
  -- ============================================
  -- PART A: 2026-H1 (Jan - Jun)
  -- ============================================

  -- 1. ISJ (生産設備)
  SELECT id INTO p_h1_isj FROM public.projects WHERE code = '1' AND period = '2026-H1';
  IF p_h1_isj IS NULL THEN
    INSERT INTO public.projects (code, name, type, software, status, period)
    VALUES ('1', 'ISJ (生産設備)', 'Equipment Design', 'ICAD', 'active', '2026-H1')
    RETURNING id INTO p_h1_isj;
  ELSE
    UPDATE public.projects SET
      name = 'ISJ (生産設備)', type = 'Equipment Design', software = 'ICAD', status = 'active'
    WHERE id = p_h1_isj;
  END IF;

  -- 2. GLW
  SELECT id INTO p_h1_glw FROM public.projects WHERE code = '2' AND period = '2026-H1';
  IF p_h1_glw IS NULL THEN
    INSERT INTO public.projects (code, name, type, software, status, period)
    VALUES ('2', 'GLW', 'EV Base Design', 'CATIA', 'active', '2026-H1')
    RETURNING id INTO p_h1_glw;
  ELSE
    UPDATE public.projects SET
      name = 'GLW', type = 'EV Base Design', software = 'CATIA', status = 'active'
    WHERE id = p_h1_glw;
  END IF;

  -- 3. GNN (河西テクノ)
  SELECT id INTO p_h1_gnn_kasai FROM public.projects WHERE code = '3' AND period = '2026-H1';
  IF p_h1_gnn_kasai IS NULL THEN
    INSERT INTO public.projects (code, name, type, software, status, period)
    VALUES ('3', 'GNN (河西テクノ)', 'Interior Parts', 'CATIA', 'active', '2026-H1')
    RETURNING id INTO p_h1_gnn_kasai;
  ELSE
    UPDATE public.projects SET
      name = 'GNN (河西テクノ)', type = 'Interior Parts', software = 'CATIA', status = 'active'
    WHERE id = p_h1_gnn_kasai;
  END IF;

  -- 4. テクノハマ
  SELECT id INTO p_h1_technohama FROM public.projects WHERE code = '4' AND period = '2026-H1';
  IF p_h1_technohama IS NULL THEN
    INSERT INTO public.projects (code, name, type, software, status, period)
    VALUES ('4', 'テクノハマ', 'Mold Data Creation', 'NX CATIA', 'active', '2026-H1')
    RETURNING id INTO p_h1_technohama;
  ELSE
    UPDATE public.projects SET
      name = 'テクノハマ', type = 'Mold Data Creation', software = 'NX CATIA', status = 'active'
    WHERE id = p_h1_technohama;
  END IF;

  -- 5. 日泉化学
  SELECT id INTO p_h1_nissen FROM public.projects WHERE code = '5' AND period = '2026-H1';
  IF p_h1_nissen IS NULL THEN
    INSERT INTO public.projects (code, name, type, software, status, period)
    VALUES ('5', '日泉化学', 'Interior Parts', 'CATIA', 'active', '2026-H1')
    RETURNING id INTO p_h1_nissen;
  ELSE
    UPDATE public.projects SET
      name = '日泉化学', type = 'Interior Parts', software = 'CATIA', status = 'active'
    WHERE id = p_h1_nissen;
  END IF;

  -- 6. VUTEQ インドネシア
  SELECT id INTO p_h1_vuteq FROM public.projects WHERE code = '6' AND period = '2026-H1';
  IF p_h1_vuteq IS NULL THEN
    INSERT INTO public.projects (code, name, type, software, status, period)
    VALUES ('6', 'VUTEQ インドネシア', 'Interior Parts', 'CATIA', 'active', '2026-H1')
    RETURNING id INTO p_h1_vuteq;
  ELSE
    UPDATE public.projects SET
      name = 'VUTEQ インドネシア', type = 'Interior Parts', software = 'CATIA', status = 'active'
    WHERE id = p_h1_vuteq;
  END IF;

  -- 7. GNN (W13G) (河西工業)
  SELECT id INTO p_h1_gnn_w13g FROM public.projects WHERE code = '7' AND period = '2026-H1';
  IF p_h1_gnn_w13g IS NULL THEN
    INSERT INTO public.projects (code, name, type, software, status, period)
    VALUES ('7', 'GNN (W13G) (河西工業)', 'Interior Parts', 'CATIA', 'active', '2026-H1')
    RETURNING id INTO p_h1_gnn_w13g;
  ELSE
    UPDATE public.projects SET
      name = 'GNN (W13G) (河西工業)', type = 'Interior Parts', software = 'CATIA', status = 'active'
    WHERE id = p_h1_gnn_w13g;
  END IF;

  -- 8. 啓装工業
  SELECT id INTO p_h1_keiso FROM public.projects WHERE code = '8' AND period = '2026-H1';
  IF p_h1_keiso IS NULL THEN
    INSERT INTO public.projects (code, name, type, software, status, period)
    VALUES ('8', '啓装工業', 'Production Equip', 'ICAD', 'active', '2026-H1')
    RETURNING id INTO p_h1_keiso;
  ELSE
    UPDATE public.projects SET
      name = '啓装工業', type = 'Production Equip', software = 'ICAD', status = 'active'
    WHERE id = p_h1_keiso;
  END IF;

  -- 9. Mobitec
  SELECT id INTO p_h1_mobitec FROM public.projects WHERE code = '9' AND period = '2026-H1';
  IF p_h1_mobitec IS NULL THEN
    INSERT INTO public.projects (code, name, type, software, status, period)
    VALUES ('9', 'Mobitec', 'Interior Parts', 'CATIA', 'active', '2026-H1')
    RETURNING id INTO p_h1_mobitec;
  ELSE
    UPDATE public.projects SET
      name = 'Mobitec', type = 'Interior Parts', software = 'CATIA', status = 'active'
    WHERE id = p_h1_mobitec;
  END IF;

  -- 10. 今里食品
  SELECT id INTO p_h1_imazato FROM public.projects WHERE code = '10' AND period = '2026-H1';
  IF p_h1_imazato IS NULL THEN
    INSERT INTO public.projects (code, name, type, software, status, period)
    VALUES ('10', '今里食品', 'Machine Automation', 'ICAD', 'active', '2026-H1')
    RETURNING id INTO p_h1_imazato;
  ELSE
    UPDATE public.projects SET
      name = '今里食品', type = 'Machine Automation', software = 'ICAD', status = 'active'
    WHERE id = p_h1_imazato;
  END IF;

  -- 11. 株式会社コイズミデザイン
  SELECT id INTO p_h1_koizumi FROM public.projects WHERE code = '11' AND period = '2026-H1';
  IF p_h1_koizumi IS NULL THEN
    INSERT INTO public.projects (code, name, type, software, status, period)
    VALUES ('11', '株式会社コイズミデザイン', 'Machine Design', 'CATIA', 'active', '2026-H1')
    RETURNING id INTO p_h1_koizumi;
  ELSE
    UPDATE public.projects SET
      name = '株式会社コイズミデザイン', type = 'Machine Design', software = 'CATIA', status = 'active'
    WHERE id = p_h1_koizumi;
  END IF;

  -- 12. 曙ブレーキ工業
  SELECT id INTO p_h1_akebono FROM public.projects WHERE code = '12' AND period = '2026-H1';
  IF p_h1_akebono IS NULL THEN
    INSERT INTO public.projects (code, name, type, software, status, period)
    VALUES ('12', '曙ブレーキ工業', 'Machine Design', 'ICAD', 'active', '2026-H1')
    RETURNING id INTO p_h1_akebono;
  ELSE
    UPDATE public.projects SET
      name = '曙ブレーキ工業', type = 'Machine Design', software = 'ICAD', status = 'active'
    WHERE id = p_h1_akebono;
  END IF;

  -- 13. 新規開拓
  SELECT id INTO p_h1_new FROM public.projects WHERE code = '13' AND period = '2026-H1';
  IF p_h1_new IS NULL THEN
    INSERT INTO public.projects (code, name, type, software, status, period)
    VALUES ('13', '新規開拓', 'Machine Design', 'CATIA', 'active', '2026-H1')
    RETURNING id INTO p_h1_new;
  ELSE
    UPDATE public.projects SET
      name = '新規開拓', type = 'Machine Design', software = 'CATIA', status = 'active'
    WHERE id = p_h1_new;
  END IF;


  -- Insert Monthly Records for H1
  INSERT INTO public.monthly_records (project_id, year, month, period_label, planned_hours, actual_hours) VALUES
  -- 1. ISJ (H1)
  (p_h1_isj, 2026, 1, '2026-H1', 0, 0),
  (p_h1_isj, 2026, 2, '2026-H1', 0, 0),
  (p_h1_isj, 2026, 3, '2026-H1', 160, 0),
  (p_h1_isj, 2026, 4, '2026-H1', 160, 0),
  (p_h1_isj, 2026, 5, '2026-H1', 160, 0),
  (p_h1_isj, 2026, 6, '2026-H1', 160, 0),
  -- 2. GLW (H1)
  (p_h1_glw, 2026, 1, '2026-H1', 0, 0),
  (p_h1_glw, 2026, 2, '2026-H1', 0, 0),
  (p_h1_glw, 2026, 3, '2026-H1', 80, 0),
  (p_h1_glw, 2026, 4, '2026-H1', 80, 0),
  (p_h1_glw, 2026, 5, '2026-H1', 80, 0),
  (p_h1_glw, 2026, 6, '2026-H1', 80, 0),
  -- 3. GNN (H1)
  (p_h1_gnn_kasai, 2026, 1, '2026-H1', 0, 0),
  (p_h1_gnn_kasai, 2026, 2, '2026-H1', 0, 0),
  (p_h1_gnn_kasai, 2026, 3, '2026-H1', 100, 0),
  (p_h1_gnn_kasai, 2026, 4, '2026-H1', 100, 0),
  (p_h1_gnn_kasai, 2026, 5, '2026-H1', 100, 0),
  (p_h1_gnn_kasai, 2026, 6, '2026-H1', 100, 0),
  -- 4. Technohama (H1)
  (p_h1_technohama, 2026, 1, '2026-H1', 0, 0),
  (p_h1_technohama, 2026, 2, '2026-H1', 0, 0),
  (p_h1_technohama, 2026, 3, '2026-H1', 50, 0),
  (p_h1_technohama, 2026, 4, '2026-H1', 50, 0),
  (p_h1_technohama, 2026, 5, '2026-H1', 50, 0),
  (p_h1_technohama, 2026, 6, '2026-H1', 50, 0),
  -- 5. Nissen (H1)
  (p_h1_nissen, 2026, 1, '2026-H1', 0, 0),
  (p_h1_nissen, 2026, 2, '2026-H1', 0, 0),
  (p_h1_nissen, 2026, 3, '2026-H1', 50, 0),
  (p_h1_nissen, 2026, 4, '2026-H1', 50, 0),
  (p_h1_nissen, 2026, 5, '2026-H1', 50, 0),
  (p_h1_nissen, 2026, 6, '2026-H1', 50, 0),
  -- 6. Vuteq (H1)
  (p_h1_vuteq, 2026, 1, '2026-H1', 0, 0),
  (p_h1_vuteq, 2026, 2, '2026-H1', 0, 0),
  (p_h1_vuteq, 2026, 3, '2026-H1', 100, 0),
  (p_h1_vuteq, 2026, 4, '2026-H1', 100, 0),
  (p_h1_vuteq, 2026, 5, '2026-H1', 100, 0),
  (p_h1_vuteq, 2026, 6, '2026-H1', 100, 0),
  -- 7. GNN W13G (H1)
  (p_h1_gnn_w13g, 2026, 1, '2026-H1', 200, 0),
  (p_h1_gnn_w13g, 2026, 2, '2026-H1', 200, 0),
  (p_h1_gnn_w13g, 2026, 3, '2026-H1', 200, 0),
  (p_h1_gnn_w13g, 2026, 4, '2026-H1', 200, 0),
  (p_h1_gnn_w13g, 2026, 5, '2026-H1', 200, 0),
  (p_h1_gnn_w13g, 2026, 6, '2026-H1', 200, 0),
  -- 8. Keiso (H1)
  (p_h1_keiso, 2026, 1, '2026-H1', 0, 0),
  (p_h1_keiso, 2026, 2, '2026-H1', 0, 0),
  (p_h1_keiso, 2026, 3, '2026-H1', 50, 0),
  (p_h1_keiso, 2026, 4, '2026-H1', 50, 0),
  (p_h1_keiso, 2026, 5, '2026-H1', 50, 0),
  (p_h1_keiso, 2026, 6, '2026-H1', 50, 0),
  -- 9. Mobitec (H1)
  (p_h1_mobitec, 2026, 1, '2026-H1', 0, 0),
  (p_h1_mobitec, 2026, 2, '2026-H1', 50, 0),
  (p_h1_mobitec, 2026, 3, '2026-H1', 80, 0),
  (p_h1_mobitec, 2026, 4, '2026-H1', 80, 0),
  (p_h1_mobitec, 2026, 5, '2026-H1', 80, 0),
  (p_h1_mobitec, 2026, 6, '2026-H1', 80, 0),
  -- 10. Imazato (H1)
  (p_h1_imazato, 2026, 1, '2026-H1', 0, 0),
  (p_h1_imazato, 2026, 2, '2026-H1', 0, 0),
  (p_h1_imazato, 2026, 3, '2026-H1', 50, 0),
  (p_h1_imazato, 2026, 4, '2026-H1', 50, 0),
  (p_h1_imazato, 2026, 5, '2026-H1', 50, 0),
  (p_h1_imazato, 2026, 6, '2026-H1', 50, 0),
  -- 11. Koizumi (H1)
  (p_h1_koizumi, 2026, 1, '2026-H1', 0, 0),
  (p_h1_koizumi, 2026, 2, '2026-H1', 0, 0),
  (p_h1_koizumi, 2026, 3, '2026-H1', 50, 0),
  (p_h1_koizumi, 2026, 4, '2026-H1', 50, 0),
  (p_h1_koizumi, 2026, 5, '2026-H1', 50, 0),
  (p_h1_koizumi, 2026, 6, '2026-H1', 50, 0),
  -- 12. Akebono (H1)
  (p_h1_akebono, 2026, 1, '2026-H1', 0, 0),
  (p_h1_akebono, 2026, 2, '2026-H1', 0, 0),
  (p_h1_akebono, 2026, 3, '2026-H1', 50, 0),
  (p_h1_akebono, 2026, 4, '2026-H1', 50, 0),
  (p_h1_akebono, 2026, 5, '2026-H1', 50, 0),
  (p_h1_akebono, 2026, 6, '2026-H1', 50, 0),
  -- 13. New (H1)
  (p_h1_new, 2026, 1, '2026-H1', 0, 0),
  (p_h1_new, 2026, 2, '2026-H1', 0, 0),
  (p_h1_new, 2026, 3, '2026-H1', 300, 0),
  (p_h1_new, 2026, 4, '2026-H1', 300, 0),
  (p_h1_new, 2026, 5, '2026-H1', 300, 0),
  (p_h1_new, 2026, 6, '2026-H1', 300, 0)
  ON CONFLICT (project_id, period_label, year, month)
  DO UPDATE SET
    planned_hours = EXCLUDED.planned_hours,
    actual_hours = EXCLUDED.actual_hours,
    period_label = EXCLUDED.period_label;

  -- ============================================
  -- PART B: 2026-H2 (Jul - Dec)
  -- ============================================

  -- 1. ISJ (生産設備)
  SELECT id INTO p_h2_isj FROM public.projects WHERE code = '1' AND period = '2026-H2';
  IF p_h2_isj IS NULL THEN
    INSERT INTO public.projects (code, name, type, software, status, period)
    VALUES ('1', 'ISJ (生産設備)', 'Equipment Design', 'ICAD', 'active', '2026-H2')
    RETURNING id INTO p_h2_isj;
  ELSE
    UPDATE public.projects SET
      name = 'ISJ (生産設備)', type = 'Equipment Design', software = 'ICAD', status = 'active'
    WHERE id = p_h2_isj;
  END IF;

  -- 2. GLW
  SELECT id INTO p_h2_glw FROM public.projects WHERE code = '2' AND period = '2026-H2';
  IF p_h2_glw IS NULL THEN
    INSERT INTO public.projects (code, name, type, software, status, period)
    VALUES ('2', 'GLW', 'EV Base Design', 'CATIA', 'active', '2026-H2')
    RETURNING id INTO p_h2_glw;
  ELSE
    UPDATE public.projects SET
      name = 'GLW', type = 'EV Base Design', software = 'CATIA', status = 'active'
    WHERE id = p_h2_glw;
  END IF;

  -- 3. GNN (河西テクノ)
  SELECT id INTO p_h2_gnn_kasai FROM public.projects WHERE code = '3' AND period = '2026-H2';
  IF p_h2_gnn_kasai IS NULL THEN
    INSERT INTO public.projects (code, name, type, software, status, period)
    VALUES ('3', 'GNN (河西テクノ)', 'Interior Parts', 'CATIA', 'active', '2026-H2')
    RETURNING id INTO p_h2_gnn_kasai;
  ELSE
    UPDATE public.projects SET
      name = 'GNN (河西テクノ)', type = 'Interior Parts', software = 'CATIA', status = 'active'
    WHERE id = p_h2_gnn_kasai;
  END IF;

  -- 4. テクノハマ
  SELECT id INTO p_h2_technohama FROM public.projects WHERE code = '4' AND period = '2026-H2';
  IF p_h2_technohama IS NULL THEN
    INSERT INTO public.projects (code, name, type, software, status, period)
    VALUES ('4', 'テクノハマ', 'Mold Data Creation', 'NX CATIA', 'active', '2026-H2')
    RETURNING id INTO p_h2_technohama;
  ELSE
    UPDATE public.projects SET
      name = 'テクノハマ', type = 'Mold Data Creation', software = 'NX CATIA', status = 'active'
    WHERE id = p_h2_technohama;
  END IF;

  -- 5. 日泉化学
  SELECT id INTO p_h2_nissen FROM public.projects WHERE code = '5' AND period = '2026-H2';
  IF p_h2_nissen IS NULL THEN
    INSERT INTO public.projects (code, name, type, software, status, period)
    VALUES ('5', '日泉化学', 'Interior Parts', 'CATIA', 'active', '2026-H2')
    RETURNING id INTO p_h2_nissen;
  ELSE
    UPDATE public.projects SET
      name = '日泉化学', type = 'Interior Parts', software = 'CATIA', status = 'active'
    WHERE id = p_h2_nissen;
  END IF;

  -- 6. VUTEQ インドネシア
  SELECT id INTO p_h2_vuteq FROM public.projects WHERE code = '6' AND period = '2026-H2';
  IF p_h2_vuteq IS NULL THEN
    INSERT INTO public.projects (code, name, type, software, status, period)
    VALUES ('6', 'VUTEQ インドネシア', 'Interior Parts', 'CATIA', 'active', '2026-H2')
    RETURNING id INTO p_h2_vuteq;
  ELSE
    UPDATE public.projects SET
      name = 'VUTEQ インドネシア', type = 'Interior Parts', software = 'CATIA', status = 'active'
    WHERE id = p_h2_vuteq;
  END IF;

  -- 7. GNN (W13G) (河西工業)
  SELECT id INTO p_h2_gnn_w13g FROM public.projects WHERE code = '7' AND period = '2026-H2';
  IF p_h2_gnn_w13g IS NULL THEN
    INSERT INTO public.projects (code, name, type, software, status, period)
    VALUES ('7', 'GNN (W13G) (河西工業)', 'Interior Parts', 'CATIA', 'active', '2026-H2')
    RETURNING id INTO p_h2_gnn_w13g;
  ELSE
    UPDATE public.projects SET
      name = 'GNN (W13G) (河西工業)', type = 'Interior Parts', software = 'CATIA', status = 'active'
    WHERE id = p_h2_gnn_w13g;
  END IF;

  -- 8. 啓装工業
  SELECT id INTO p_h2_keiso FROM public.projects WHERE code = '8' AND period = '2026-H2';
  IF p_h2_keiso IS NULL THEN
    INSERT INTO public.projects (code, name, type, software, status, period)
    VALUES ('8', '啓装工業', 'Production Equip', 'ICAD', 'active', '2026-H2')
    RETURNING id INTO p_h2_keiso;
  ELSE
    UPDATE public.projects SET
      name = '啓装工業', type = 'Production Equip', software = 'ICAD', status = 'active'
    WHERE id = p_h2_keiso;
  END IF;

  -- 9. Mobitec
  SELECT id INTO p_h2_mobitec FROM public.projects WHERE code = '9' AND period = '2026-H2';
  IF p_h2_mobitec IS NULL THEN
    INSERT INTO public.projects (code, name, type, software, status, period)
    VALUES ('9', 'Mobitec', 'Interior Parts', 'CATIA', 'active', '2026-H2')
    RETURNING id INTO p_h2_mobitec;
  ELSE
    UPDATE public.projects SET
      name = 'Mobitec', type = 'Interior Parts', software = 'CATIA', status = 'active'
    WHERE id = p_h2_mobitec;
  END IF;

  -- 10. 今里食品
  SELECT id INTO p_h2_imazato FROM public.projects WHERE code = '10' AND period = '2026-H2';
  IF p_h2_imazato IS NULL THEN
    INSERT INTO public.projects (code, name, type, software, status, period)
    VALUES ('10', '今里食品', 'Machine Automation', 'ICAD', 'active', '2026-H2')
    RETURNING id INTO p_h2_imazato;
  ELSE
    UPDATE public.projects SET
      name = '今里食品', type = 'Machine Automation', software = 'ICAD', status = 'active'
    WHERE id = p_h2_imazato;
  END IF;

  -- 11. 株式会社コイズミデザイン
  SELECT id INTO p_h2_koizumi FROM public.projects WHERE code = '11' AND period = '2026-H2';
  IF p_h2_koizumi IS NULL THEN
    INSERT INTO public.projects (code, name, type, software, status, period)
    VALUES ('11', '株式会社コイズミデザイン', 'Machine Design', 'CATIA', 'active', '2026-H2')
    RETURNING id INTO p_h2_koizumi;
  ELSE
    UPDATE public.projects SET
      name = '株式会社コイズミデザイン', type = 'Machine Design', software = 'CATIA', status = 'active'
    WHERE id = p_h2_koizumi;
  END IF;

  -- 12. 曙ブレーキ工業
  SELECT id INTO p_h2_akebono FROM public.projects WHERE code = '12' AND period = '2026-H2';
  IF p_h2_akebono IS NULL THEN
    INSERT INTO public.projects (code, name, type, software, status, period)
    VALUES ('12', '曙ブレーキ工業', 'Machine Design', 'ICAD', 'active', '2026-H2')
    RETURNING id INTO p_h2_akebono;
  ELSE
    UPDATE public.projects SET
      name = '曙ブレーキ工業', type = 'Machine Design', software = 'ICAD', status = 'active'
    WHERE id = p_h2_akebono;
  END IF;

  -- 13. 新規開拓
  SELECT id INTO p_h2_new FROM public.projects WHERE code = '13' AND period = '2026-H2';
  IF p_h2_new IS NULL THEN
    INSERT INTO public.projects (code, name, type, software, status, period)
    VALUES ('13', '新規開拓', 'Machine Design', 'CATIA', 'active', '2026-H2')
    RETURNING id INTO p_h2_new;
  ELSE
    UPDATE public.projects SET
      name = '新規開拓', type = 'Machine Design', software = 'CATIA', status = 'active'
    WHERE id = p_h2_new;
  END IF;


  -- Insert Monthly Records for H2
  INSERT INTO public.monthly_records (project_id, year, month, period_label, planned_hours, actual_hours) VALUES
  -- 1. ISJ (H2)
  (p_h2_isj, 2026, 7, '2026-H2', 160, 0),
  (p_h2_isj, 2026, 8, '2026-H2', 160, 0),
  (p_h2_isj, 2026, 9, '2026-H2', 160, 0),
  (p_h2_isj, 2026, 10, '2026-H2', 160, 0),
  (p_h2_isj, 2026, 11, '2026-H2', 160, 0),
  (p_h2_isj, 2026, 12, '2026-H2', 160, 0),
  -- 2. GLW (H2)
  (p_h2_glw, 2026, 7, '2026-H2', 100, 0),
  (p_h2_glw, 2026, 8, '2026-H2', 100, 0),
  (p_h2_glw, 2026, 9, '2026-H2', 100, 0),
  (p_h2_glw, 2026, 10, '2026-H2', 100, 0),
  (p_h2_glw, 2026, 11, '2026-H2', 100, 0),
  (p_h2_glw, 2026, 12, '2026-H2', 100, 0),
  -- 3. GNN (H2)
  (p_h2_gnn_kasai, 2026, 7, '2026-H2', 100, 0),
  (p_h2_gnn_kasai, 2026, 8, '2026-H2', 100, 0),
  (p_h2_gnn_kasai, 2026, 9, '2026-H2', 100, 0),
  (p_h2_gnn_kasai, 2026, 10, '2026-H2', 100, 0),
  (p_h2_gnn_kasai, 2026, 11, '2026-H2', 100, 0),
  (p_h2_gnn_kasai, 2026, 12, '2026-H2', 100, 0),
  -- 4. Technohama (H2)
  (p_h2_technohama, 2026, 7, '2026-H2', 50, 0),
  (p_h2_technohama, 2026, 8, '2026-H2', 50, 0),
  (p_h2_technohama, 2026, 9, '2026-H2', 50, 0),
  (p_h2_technohama, 2026, 10, '2026-H2', 50, 0),
  (p_h2_technohama, 2026, 11, '2026-H2', 50, 0),
  (p_h2_technohama, 2026, 12, '2026-H2', 50, 0),
  -- 5. Nissen (H2)
  (p_h2_nissen, 2026, 7, '2026-H2', 50, 0),
  (p_h2_nissen, 2026, 8, '2026-H2', 50, 0),
  (p_h2_nissen, 2026, 9, '2026-H2', 50, 0),
  (p_h2_nissen, 2026, 10, '2026-H2', 50, 0),
  (p_h2_nissen, 2026, 11, '2026-H2', 50, 0),
  (p_h2_nissen, 2026, 12, '2026-H2', 50, 0),
  -- 6. Vuteq (H2)
  (p_h2_vuteq, 2026, 7, '2026-H2', 100, 0),
  (p_h2_vuteq, 2026, 8, '2026-H2', 100, 0),
  (p_h2_vuteq, 2026, 9, '2026-H2', 100, 0),
  (p_h2_vuteq, 2026, 10, '2026-H2', 100, 0),
  (p_h2_vuteq, 2026, 11, '2026-H2', 100, 0),
  (p_h2_vuteq, 2026, 12, '2026-H2', 100, 0),
  -- 7. GNN W13G (H2)
  (p_h2_gnn_w13g, 2026, 7, '2026-H2', 200, 0),
  (p_h2_gnn_w13g, 2026, 8, '2026-H2', 200, 0),
  (p_h2_gnn_w13g, 2026, 9, '2026-H2', 200, 0),
  (p_h2_gnn_w13g, 2026, 10, '2026-H2', 200, 0),
  (p_h2_gnn_w13g, 2026, 11, '2026-H2', 200, 0),
  (p_h2_gnn_w13g, 2026, 12, '2026-H2', 180, 0),
  -- 8. Keiso (H2)
  (p_h2_keiso, 2026, 7, '2026-H2', 50, 0),
  (p_h2_keiso, 2026, 8, '2026-H2', 50, 0),
  (p_h2_keiso, 2026, 9, '2026-H2', 50, 0),
  (p_h2_keiso, 2026, 10, '2026-H2', 50, 0),
  (p_h2_keiso, 2026, 11, '2026-H2', 50, 0),
  (p_h2_keiso, 2026, 12, '2026-H2', 50, 0),
  -- 9. Mobitec (H2)
  (p_h2_mobitec, 2026, 7, '2026-H2', 80, 0),
  (p_h2_mobitec, 2026, 8, '2026-H2', 80, 0),
  (p_h2_mobitec, 2026, 9, '2026-H2', 80, 0),
  (p_h2_mobitec, 2026, 10, '2026-H2', 80, 0),
  (p_h2_mobitec, 2026, 11, '2026-H2', 80, 0),
  (p_h2_mobitec, 2026, 12, '2026-H2', 80, 0),
  -- 10. Imazato (H2)
  (p_h2_imazato, 2026, 7, '2026-H2', 50, 0),
  (p_h2_imazato, 2026, 8, '2026-H2', 50, 0),
  (p_h2_imazato, 2026, 9, '2026-H2', 50, 0),
  (p_h2_imazato, 2026, 10, '2026-H2', 50, 0),
  (p_h2_imazato, 2026, 11, '2026-H2', 50, 0),
  (p_h2_imazato, 2026, 12, '2026-H2', 50, 0),
  -- 11. Koizumi (H2)
  (p_h2_koizumi, 2026, 7, '2026-H2', 50, 0),
  (p_h2_koizumi, 2026, 8, '2026-H2', 50, 0),
  (p_h2_koizumi, 2026, 9, '2026-H2', 50, 0),
  (p_h2_koizumi, 2026, 10, '2026-H2', 50, 0),
  (p_h2_koizumi, 2026, 11, '2026-H2', 50, 0),
  (p_h2_koizumi, 2026, 12, '2026-H2', 50, 0),
  -- 12. Akebono (H2)
  (p_h2_akebono, 2026, 7, '2026-H2', 50, 0),
  (p_h2_akebono, 2026, 8, '2026-H2', 50, 0),
  (p_h2_akebono, 2026, 9, '2026-H2', 50, 0),
  (p_h2_akebono, 2026, 10, '2026-H2', 50, 0),
  (p_h2_akebono, 2026, 11, '2026-H2', 50, 0),
  (p_h2_akebono, 2026, 12, '2026-H2', 50, 0),
  -- 13. New (H2)
  (p_h2_new, 2026, 7, '2026-H2', 300, 0),
  (p_h2_new, 2026, 8, '2026-H2', 300, 0),
  (p_h2_new, 2026, 9, '2026-H2', 300, 0),
  (p_h2_new, 2026, 10, '2026-H2', 300, 0),
  (p_h2_new, 2026, 11, '2026-H2', 300, 0),
  (p_h2_new, 2026, 12, '2026-H2', 300, 0)

  ON CONFLICT (project_id, period_label, year, month)
  DO UPDATE SET
    planned_hours = EXCLUDED.planned_hours,
    actual_hours = EXCLUDED.actual_hours,
    period_label = EXCLUDED.period_label;

END $$;
