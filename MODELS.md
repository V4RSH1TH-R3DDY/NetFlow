# NetFlow ML Model Registry

This document tracks the deployment and characteristics of the machine learning models used in the NetFlow Intrusion Detection System.

## Latest Deployment: v1_20260428102639

- **Algorithm**: Random Forest Classifier + Isolation Forest
- **Dataset**: CSE-CIC-IDS2018 (sampled 546,906 flows)
- **Status**: **PRODUCTION**

### Performance Metrics
- **Accuracy**: 92.58%
- **F1 Score**: 90.71%
- **AUC-ROC**: 0.9831

### Key Detected Threats
| Threat Class | Precision | Recall | F1 |
| :--- | :--- | :--- | :--- |
| **SSH-BRUTEFORCE** | 1.00 | 1.00 | 1.00 |
| **DDOS-HOIC** | 0.69 | 0.99 | 0.81 |
| **FTP-BRUTEFORCE** | 0.72 | 0.89 | 0.80 |
| **BENIGN** | 0.95 | 0.99 | 0.97 |

### Feature Importance (Top 5)
1. **unique_dst_ports**: 0.1713
2. **iat_max**: 0.1293
3. **avg_packet_size**: 0.1011
4. **iat_mean**: 0.0886
5. **duration_sec**: 0.0815

## Versioning Policy
- `v1_<timestamp>`: Models trained on flow-based features with standard stratification.
- All models are registered in the `model_registry` table with full metadata.

## Inference usage
```python
from ml.inference import get_model
model = get_model() # Loads latest v1_
result = model.predict(features)
```
