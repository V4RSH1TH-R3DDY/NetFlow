-- SQL to enable real-time packet notifications
-- Phase 7.1 requirements

CREATE OR REPLACE FUNCTION notify_packet() RETURNS trigger AS $$
DECLARE
    payload jsonb;
BEGIN
    payload = jsonb_build_object(
        'packet_id', NEW.packet_id,
        'captured_at', NEW.captured_at,
        'src_ip', NEW.src_ip::text,
        'dst_ip', NEW.dst_ip::text,
        'src_port', NEW.src_port,
        'dst_port', NEW.dst_port,
        'protocol', NEW.protocol,
        'packet_size', NEW.packet_size,
        'tcp_flags', NEW.tcp_flags
    );
    PERFORM pg_notify('live_packets', payload::text);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS packet_notify_trigger ON packets;
CREATE TRIGGER packet_notify_trigger 
AFTER INSERT ON packets 
FOR EACH ROW EXECUTE FUNCTION notify_packet();
