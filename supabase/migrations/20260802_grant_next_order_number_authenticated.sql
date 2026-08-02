-- A RPC next_order_number só tinha EXECUTE para postgres e service_role.
-- O PDV usa cliente autenticado (JWT), então precisa de acesso para authenticated.
GRANT EXECUTE ON FUNCTION next_order_number(uuid) TO authenticated;
