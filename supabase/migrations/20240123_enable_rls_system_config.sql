-- Enable RLS on system_config table
ALTER TABLE public.system_config ENABLE ROW LEVEL SECURITY;

-- Create policy to allow read access for all authenticated users
CREATE POLICY "Allow read access for all" ON public.system_config
    FOR SELECT
    USING (true);

-- Create policy to restrict write access (no writes allowed via API)
CREATE POLICY "No write access" ON public.system_config
    FOR ALL
    USING (false);