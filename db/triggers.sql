-- Auto-generate alerts from high-confidence malicious predictions

CREATE OR REPLACE FUNCTION fn_create_alert_from_prediction()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    label_code TEXT;
BEGIN
    IF NEW.predicted_label_id IS NULL THEN
        RETURN NEW;
    END IF;

    SELECT al.label_code
    INTO label_code
    FROM attack_labels al
    WHERE al.label_id = NEW.predicted_label_id;

    IF label_code IS NULL OR label_code = 'BENIGN' THEN
        RETURN NEW;
    END IF;

    IF NEW.confidence >= 0.90000 THEN
        INSERT INTO alerts (
            session_id,
            prediction_id,
            alert_type,
            severity,
            status,
            rule_name,
            description,
            metadata
        ) VALUES (
            NEW.session_id,
            NEW.prediction_id,
            'ml_prediction',
            4,
            'open',
            'high_confidence_non_benign',
            'Auto-generated from ML prediction confidence threshold',
            jsonb_build_object('confidence', NEW.confidence, 'model_version', NEW.model_version)
        );
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prediction_alert ON predictions;

CREATE TRIGGER trg_prediction_alert
AFTER INSERT ON predictions
FOR EACH ROW
EXECUTE FUNCTION fn_create_alert_from_prediction();
