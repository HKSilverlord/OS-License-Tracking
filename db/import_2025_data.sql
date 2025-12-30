-- Import Project Data from CSV (2026)
-- This script imports projects and monthly records into the database.
-- Logic refined to support "Project Scoping Per Period/Year".
-- Uses manual ID lookup to ensure projects are scoped to 2026, avoiding global code conflicts.

-- Ensure 2026 periods exist
INSERT INTO public.periods (label) VALUES
('2026-H1'),
('2026-H2')
ON CONFLICT (label) DO NOTHING;

DO $$
DECLARE
  p_isj UUID;
  p_glw UUID;
  p_gnn_kasai UUID;
  p_technohama UUID;
  p_nissen UUID;
  p_vuteq UUID;
  p_gnn_w13g UUID;
  p_keiso UUID;
  p_mobitec UUID;
  p_imazato UUID;
  p_koizumi UUID;
  p_akebono UUID;
  p_new UUID;
BEGIN
  -- ============================================
  -- STEP 1: Insert/Update Projects (Scoped to 2026)
  -- ============================================

  -- 1. ISJ (生産設備)
  SELECT id INTO p_isj FROM public.projects WHERE code = '1' AND year = 2026;
  IF p_isj IS NULL THEN
    INSERT INTO public.projects (code, name, type, software, status, year)
    VALUES ('1', 'ISJ (生産設備)', 'Equipment Design', 'ICAD', 'active', 2026)
    RETURNING id INTO p_isj;
  ELSE
    UPDATE public.projects SET
      name = 'ISJ (生産設備)', type = 'Equipment Design', software = 'ICAD', status = 'active'
    WHERE id = p_isj;
  END IF;

  -- 2. GLW
  SELECT id INTO p_glw FROM public.projects WHERE code = '2' AND year = 2026;
  IF p_glw IS NULL THEN
    INSERT INTO public.projects (code, name, type, software, status, year)
    VALUES ('2', 'GLW', 'EV Base Design', 'CATIA', 'active', 2026)
    RETURNING id INTO p_glw;
  ELSE
    UPDATE public.projects SET
      name = 'GLW', type = 'EV Base Design', software = 'CATIA', status = 'active'
    WHERE id = p_glw;
  END IF;

  -- 3. GNN (河西テクノ)
  SELECT id INTO p_gnn_kasai FROM public.projects WHERE code = '3' AND year = 2026;
  IF p_gnn_kasai IS NULL THEN
    INSERT INTO public.projects (code, name, type, software, status, year)
    VALUES ('3', 'GNN (河西テクノ)', 'Interior Parts', 'CATIA', 'active', 2026)
    RETURNING id INTO p_gnn_kasai;
  ELSE
    UPDATE public.projects SET
      name = 'GNN (河西テクノ)', type = 'Interior Parts', software = 'CATIA', status = 'active'
    WHERE id = p_gnn_kasai;
  END IF;

  -- 4. テクノハマ
  SELECT id INTO p_technohama FROM public.projects WHERE code = '4' AND year = 2026;
  IF p_technohama IS NULL THEN
    INSERT INTO public.projects (code, name, type, software, status, year)
    VALUES ('4', 'テクノハマ', 'Mold Data Creation', 'NX CATIA', 'active', 2026)
    RETURNING id INTO p_technohama;
  ELSE
    UPDATE public.projects SET
      name = 'テクノハマ', type = 'Mold Data Creation', software = 'NX CATIA', status = 'active'
    WHERE id = p_technohama;
  END IF;

  -- 5. 日泉化学
  SELECT id INTO p_nissen FROM public.projects WHERE code = '5' AND year = 2026;
  IF p_nissen IS NULL THEN
    INSERT INTO public.projects (code, name, type, software, status, year)
    VALUES ('5', '日泉化学', 'Interior Parts', 'CATIA', 'active', 2026)
    RETURNING id INTO p_nissen;
  ELSE
    UPDATE public.projects SET
      name = '日泉化学', type = 'Interior Parts', software = 'CATIA', status = 'active'
    WHERE id = p_nissen;
  END IF;

  -- 6. VUTEQ インドネシア
  SELECT id INTO p_vuteq FROM public.projects WHERE code = '6' AND year = 2026;
  IF p_vuteq IS NULL THEN
    INSERT INTO public.projects (code, name, type, software, status, year)
    VALUES ('6', 'VUTEQ インドネシア', 'Interior Parts', 'CATIA', 'active', 2026)
    RETURNING id INTO p_vuteq;
  ELSE
    UPDATE public.projects SET
      name = 'VUTEQ インドネシア', type = 'Interior Parts', software = 'CATIA', status = 'active'
    WHERE id = p_vuteq;
  END IF;

  -- 7. GNN (W13G) (河西工業)
  SELECT id INTO p_gnn_w13g FROM public.projects WHERE code = '7' AND year = 2026;
  IF p_gnn_w13g IS NULL THEN
    INSERT INTO public.projects (code, name, type, software, status, year)
    VALUES ('7', 'GNN (W13G) (河西工業)', 'Interior Parts', 'CATIA', 'active', 2026)
    RETURNING id INTO p_gnn_w13g;
  ELSE
    UPDATE public.projects SET
      name = 'GNN (W13G) (河西工業)', type = 'Interior Parts', software = 'CATIA', status = 'active'
    WHERE id = p_gnn_w13g;
  END IF;

  -- 8. 啓装工業
  SELECT id INTO p_keiso FROM public.projects WHERE code = '8' AND year = 2026;
  IF p_keiso IS NULL THEN
    INSERT INTO public.projects (code, name, type, software, status, year)
    VALUES ('8', '啓装工業', 'Production Equip', 'ICAD', 'active', 2026)
    RETURNING id INTO p_keiso;
  ELSE
    UPDATE public.projects SET
      name = '啓装工業', type = 'Production Equip', software = 'ICAD', status = 'active'
    WHERE id = p_keiso;
  END IF;

  -- 9. Mobitec
  SELECT id INTO p_mobitec FROM public.projects WHERE code = '9' AND year = 2026;
  IF p_mobitec IS NULL THEN
    INSERT INTO public.projects (code, name, type, software, status, year)
    VALUES ('9', 'Mobitec', 'Interior Parts', 'CATIA', 'active', 2026)
    RETURNING id INTO p_mobitec;
  ELSE
    UPDATE public.projects SET
      name = 'Mobitec', type = 'Interior Parts', software = 'CATIA', status = 'active'
    WHERE id = p_mobitec;
  END IF;

  -- 10. 今里食品
  SELECT id INTO p_imazato FROM public.projects WHERE code = '10' AND year = 2026;
  IF p_imazato IS NULL THEN
    INSERT INTO public.projects (code, name, type, software, status, year)
    VALUES ('10', '今里食品', 'Machine Automation', 'ICAD', 'active', 2026)
    RETURNING id INTO p_imazato;
  ELSE
    UPDATE public.projects SET
      name = '今里食品', type = 'Machine Automation', software = 'ICAD', status = 'active'
    WHERE id = p_imazato;
  END IF;

  -- 11. 株式会社コイズミデザイン
  SELECT id INTO p_koizumi FROM public.projects WHERE code = '11' AND year = 2026;
  IF p_koizumi IS NULL THEN
    INSERT INTO public.projects (code, name, type, software, status, year)
    VALUES ('11', '株式会社コイズミデザイン', 'Machine Design', 'CATIA', 'active', 2026)
    RETURNING id INTO p_koizumi;
  ELSE
    UPDATE public.projects SET
      name = '株式会社コイズミデザイン', type = 'Machine Design', software = 'CATIA', status = 'active'
    WHERE id = p_koizumi;
  END IF;

  -- 12. 曙ブレーキ工業
  SELECT id INTO p_akebono FROM public.projects WHERE code = '12' AND year = 2026;
  IF p_akebono IS NULL THEN
    INSERT INTO public.projects (code, name, type, software, status, year)
    VALUES ('12', '曙ブレーキ工業', 'Machine Design', 'ICAD', 'active', 2026)
    RETURNING id INTO p_akebono;
  ELSE
    UPDATE public.projects SET
      name = '曙ブレーキ工業', type = 'Machine Design', software = 'ICAD', status = 'active'
    WHERE id = p_akebono;
  END IF;

  -- 13. 新規開拓
  SELECT id INTO p_new FROM public.projects WHERE code = '13' AND year = 2026;
  IF p_new IS NULL THEN
    INSERT INTO public.projects (code, name, type, software, status, year)
    VALUES ('13', '新規開拓', 'Machine Design', 'CATIA', 'active', 2026)
    RETURNING id INTO p_new;
  ELSE
    UPDATE public.projects SET
      name = '新規開拓', type = 'Machine Design', software = 'CATIA', status = 'active'
    WHERE id = p_new;
  END IF;

  -- ============================================
  -- STEP 2: Insert Monthly Records (2026)
  -- ============================================
  
  INSERT INTO public.monthly_records (project_id, year, month, period_label, planned_hours, actual_hours) VALUES
  -- 1. ISJ (生産設備)
  (p_isj, 2026, 1, '2026-H1', 0, 0),
  (p_isj, 2026, 2, '2026-H1', 0, 0),
  (p_isj, 2026, 3, '2026-H1', 160, 0),
  (p_isj, 2026, 4, '2026-H1', 160, 0),
  (p_isj, 2026, 5, '2026-H1', 160, 0),
  (p_isj, 2026, 6, '2026-H1', 160, 0),
  (p_isj, 2026, 7, '2026-H2', 160, 0),
  (p_isj, 2026, 8, '2026-H2', 160, 0),
  (p_isj, 2026, 9, '2026-H2', 160, 0),
  (p_isj, 2026, 10, '2026-H2', 160, 0),
  (p_isj, 2026, 11, '2026-H2', 160, 0),
  (p_isj, 2026, 12, '2026-H2', 160, 0),

  -- 2. GLW
  (p_glw, 2026, 1, '2026-H1', 0, 0),
  (p_glw, 2026, 2, '2026-H1', 0, 0),
  (p_glw, 2026, 3, '2026-H1', 80, 0),
  (p_glw, 2026, 4, '2026-H1', 80, 0),
  (p_glw, 2026, 5, '2026-H1', 80, 0),
  (p_glw, 2026, 6, '2026-H1', 80, 0),
  (p_glw, 2026, 7, '2026-H2', 100, 0),
  (p_glw, 2026, 8, '2026-H2', 100, 0),
  (p_glw, 2026, 9, '2026-H2', 100, 0),
  (p_glw, 2026, 10, '2026-H2', 100, 0),
  (p_glw, 2026, 11, '2026-H2', 100, 0),
  (p_glw, 2026, 12, '2026-H2', 100, 0),

  -- 3. GNN (河西テクノ)
  (p_gnn_kasai, 2026, 1, '2026-H1', 0, 0), 
  (p_gnn_kasai, 2026, 2, '2026-H1', 0, 0),
  (p_gnn_kasai, 2026, 3, '2026-H1', 100, 0),
  (p_gnn_kasai, 2026, 4, '2026-H1', 100, 0),
  (p_gnn_kasai, 2026, 5, '2026-H1', 100, 0),
  (p_gnn_kasai, 2026, 6, '2026-H1', 100, 0),
  (p_gnn_kasai, 2026, 7, '2026-H2', 100, 0),
  (p_gnn_kasai, 2026, 8, '2026-H2', 100, 0),
  (p_gnn_kasai, 2026, 9, '2026-H2', 100, 0),
  (p_gnn_kasai, 2026, 10, '2026-H2', 100, 0),
  (p_gnn_kasai, 2026, 11, '2026-H2', 100, 0),
  (p_gnn_kasai, 2026, 12, '2026-H2', 100, 0),

  -- 4. テクノハマ
  (p_technohama, 2026, 1, '2026-H1', 0, 0),
  (p_technohama, 2026, 2, '2026-H1', 0, 0),
  (p_technohama, 2026, 3, '2026-H1', 50, 0),
  (p_technohama, 2026, 4, '2026-H1', 50, 0),
  (p_technohama, 2026, 5, '2026-H1', 50, 0),
  (p_technohama, 2026, 6, '2026-H1', 50, 0),
  (p_technohama, 2026, 7, '2026-H2', 50, 0),
  (p_technohama, 2026, 8, '2026-H2', 50, 0),
  (p_technohama, 2026, 9, '2026-H2', 50, 0),
  (p_technohama, 2026, 10, '2026-H2', 50, 0),
  (p_technohama, 2026, 11, '2026-H2', 50, 0),
  (p_technohama, 2026, 12, '2026-H2', 50, 0),

  -- 5. 日泉化学
  (p_nissen, 2026, 1, '2026-H1', 0, 0),
  (p_nissen, 2026, 2, '2026-H1', 0, 0),
  (p_nissen, 2026, 3, '2026-H1', 50, 0),
  (p_nissen, 2026, 4, '2026-H1', 50, 0),
  (p_nissen, 2026, 5, '2026-H1', 50, 0),
  (p_nissen, 2026, 6, '2026-H1', 50, 0),
  (p_nissen, 2026, 7, '2026-H2', 50, 0),
  (p_nissen, 2026, 8, '2026-H2', 50, 0),
  (p_nissen, 2026, 9, '2026-H2', 50, 0),
  (p_nissen, 2026, 10, '2026-H2', 50, 0),
  (p_nissen, 2026, 11, '2026-H2', 50, 0),
  (p_nissen, 2026, 12, '2026-H2', 50, 0),

  -- 6. VUTEQ インドネシア
  (p_vuteq, 2026, 1, '2026-H1', 0, 0),
  (p_vuteq, 2026, 2, '2026-H1', 0, 0),
  (p_vuteq, 2026, 3, '2026-H1', 100, 0),
  (p_vuteq, 2026, 4, '2026-H1', 100, 0),
  (p_vuteq, 2026, 5, '2026-H1', 100, 0),
  (p_vuteq, 2026, 6, '2026-H1', 100, 0),
  (p_vuteq, 2026, 7, '2026-H2', 100, 0),
  (p_vuteq, 2026, 8, '2026-H2', 100, 0),
  (p_vuteq, 2026, 9, '2026-H2', 100, 0),
  (p_vuteq, 2026, 10, '2026-H2', 100, 0),
  (p_vuteq, 2026, 11, '2026-H2', 100, 0),
  (p_vuteq, 2026, 12, '2026-H2', 100, 0),

  -- 7. GNN (W13G) (河西工業)
  (p_gnn_w13g, 2026, 1, '2026-H1', 200, 0),
  (p_gnn_w13g, 2026, 2, '2026-H1', 200, 0),
  (p_gnn_w13g, 2026, 3, '2026-H1', 200, 0),
  (p_gnn_w13g, 2026, 4, '2026-H1', 200, 0),
  (p_gnn_w13g, 2026, 5, '2026-H1', 200, 0),
  (p_gnn_w13g, 2026, 6, '2026-H1', 200, 0),
  (p_gnn_w13g, 2026, 7, '2026-H2', 200, 0),
  (p_gnn_w13g, 2026, 8, '2026-H2', 200, 0),
  (p_gnn_w13g, 2026, 9, '2026-H2', 200, 0),
  (p_gnn_w13g, 2026, 10, '2026-H2', 200, 0),
  (p_gnn_w13g, 2026, 11, '2026-H2', 200, 0),
  (p_gnn_w13g, 2026, 12, '2026-H2', 180, 0),

  -- 8. 啓装工業
  (p_keiso, 2026, 1, '2026-H1', 0, 0),
  (p_keiso, 2026, 2, '2026-H1', 0, 0),
  (p_keiso, 2026, 3, '2026-H1', 50, 0),
  (p_keiso, 2026, 4, '2026-H1', 50, 0),
  (p_keiso, 2026, 5, '2026-H1', 50, 0),
  (p_keiso, 2026, 6, '2026-H1', 50, 0),
  (p_keiso, 2026, 7, '2026-H2', 50, 0),
  (p_keiso, 2026, 8, '2026-H2', 50, 0),
  (p_keiso, 2026, 9, '2026-H2', 50, 0),
  (p_keiso, 2026, 10, '2026-H2', 50, 0),
  (p_keiso, 2026, 11, '2026-H2', 50, 0),
  (p_keiso, 2026, 12, '2026-H2', 50, 0),

  -- 9. Mobitec
  (p_mobitec, 2026, 1, '2026-H1', 0, 0),
  (p_mobitec, 2026, 2, '2026-H1', 50, 0),
  (p_mobitec, 2026, 3, '2026-H1', 80, 0),
  (p_mobitec, 2026, 4, '2026-H1', 80, 0),
  (p_mobitec, 2026, 5, '2026-H1', 80, 0),
  (p_mobitec, 2026, 6, '2026-H1', 80, 0),
  (p_mobitec, 2026, 7, '2026-H2', 80, 0),
  (p_mobitec, 2026, 8, '2026-H2', 80, 0),
  (p_mobitec, 2026, 9, '2026-H2', 80, 0),
  (p_mobitec, 2026, 10, '2026-H2', 80, 0),
  (p_mobitec, 2026, 11, '2026-H2', 80, 0),
  (p_mobitec, 2026, 12, '2026-H2', 80, 0),

  -- 10. 今里食品
  (p_imazato, 2026, 1, '2026-H1', 0, 0),
  (p_imazato, 2026, 2, '2026-H1', 0, 0),
  (p_imazato, 2026, 3, '2026-H1', 50, 0),
  (p_imazato, 2026, 4, '2026-H1', 50, 0),
  (p_imazato, 2026, 5, '2026-H1', 50, 0),
  (p_imazato, 2026, 6, '2026-H1', 50, 0),
  (p_imazato, 2026, 7, '2026-H2', 50, 0),
  (p_imazato, 2026, 8, '2026-H2', 50, 0),
  (p_imazato, 2026, 9, '2026-H2', 50, 0),
  (p_imazato, 2026, 10, '2026-H2', 50, 0),
  (p_imazato, 2026, 11, '2026-H2', 50, 0),
  (p_imazato, 2026, 12, '2026-H2', 50, 0),

  -- 11. 株式会社コイズミデザイン
  (p_koizumi, 2026, 1, '2026-H1', 0, 0),
  (p_koizumi, 2026, 2, '2026-H1', 0, 0),
  (p_koizumi, 2026, 3, '2026-H1', 50, 0),
  (p_koizumi, 2026, 4, '2026-H1', 50, 0),
  (p_koizumi, 2026, 5, '2026-H1', 50, 0),
  (p_koizumi, 2026, 6, '2026-H1', 50, 0),
  (p_koizumi, 2026, 7, '2026-H2', 50, 0),
  (p_koizumi, 2026, 8, '2026-H2', 50, 0),
  (p_koizumi, 2026, 9, '2026-H2', 50, 0),
  (p_koizumi, 2026, 10, '2026-H2', 50, 0),
  (p_koizumi, 2026, 11, '2026-H2', 50, 0),
  (p_koizumi, 2026, 12, '2026-H2', 50, 0),

  -- 12. 曙ブレーキ工業
  (p_akebono, 2026, 1, '2026-H1', 0, 0),
  (p_akebono, 2026, 2, '2026-H1', 0, 0),
  (p_akebono, 2026, 3, '2026-H1', 50, 0),
  (p_akebono, 2026, 4, '2026-H1', 50, 0),
  (p_akebono, 2026, 5, '2026-H1', 50, 0),
  (p_akebono, 2026, 6, '2026-H1', 50, 0),
  (p_akebono, 2026, 7, '2026-H2', 50, 0),
  (p_akebono, 2026, 8, '2026-H2', 50, 0),
  (p_akebono, 2026, 9, '2026-H2', 50, 0),
  (p_akebono, 2026, 10, '2026-H2', 50, 0),
  (p_akebono, 2026, 11, '2026-H2', 50, 0),
  (p_akebono, 2026, 12, '2026-H2', 50, 0),

  -- 13. 新規開拓
  (p_new, 2026, 1, '2026-H1', 0, 0),
  (p_new, 2026, 2, '2026-H1', 0, 0),
  (p_new, 2026, 3, '2026-H1', 300, 0),
  (p_new, 2026, 4, '2026-H1', 300, 0),
  (p_new, 2026, 5, '2026-H1', 300, 0),
  (p_new, 2026, 6, '2026-H1', 300, 0),
  (p_new, 2026, 7, '2026-H2', 300, 0),
  (p_new, 2026, 8, '2026-H2', 300, 0),
  (p_new, 2026, 9, '2026-H2', 300, 0),
  (p_new, 2026, 10, '2026-H2', 300, 0),
  (p_new, 2026, 11, '2026-H2', 300, 0),
  (p_new, 2026, 12, '2026-H2', 300, 0)
  
  ON CONFLICT (project_id, year, month)
  DO UPDATE SET
    planned_hours = EXCLUDED.planned_hours,
    actual_hours = EXCLUDED.actual_hours,
    period_label = EXCLUDED.period_label;

END $$;
