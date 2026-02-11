import json
import math
import cv2
import os
import numpy as np

# JSON 파일 경로 (Raw string 사용)
json_file_path = r"C:\Users\user\Documents\GitHub\cvProjectTeam3\result_outside01.json"
# 이미지 파일 경로 (JSON 파일명에서 유추하거나 직접 지정)
image_file_path = r"C:\Users\user\Documents\GitHub\cvProjectTeam3\choihyunseok\outside01.jpg"

# 점자 블록 실제 크기 (단위: cm) - 일반적인 규격
BLOCK_REAL_SIZE = 30.0 

def order_points(pts):
    """
    좌표를 일관된 순서(좌상, 우상, 우하, 좌하)로 정렬합니다.
    """
    rect = np.zeros((4, 2), dtype="float32")
    s = pts.sum(axis=1)
    rect[0] = pts[np.argmin(s)] # 좌상 (합이 최소)
    rect[2] = pts[np.argmax(s)] # 우하 (합이 최대)

    diff = np.diff(pts, axis=1)
    rect[1] = pts[np.argmin(diff)] # 우상 (차이가 최소)
    rect[3] = pts[np.argmax(diff)] # 좌하 (차이가 최대)
    return rect

def get_perspective_transform_matrix(src_box):
    """
    탐지된 박스 좌표(src_box)를 30x30cm 정사각형으로 변환하는 행렬을 구합니다.
    """
    rect = order_points(src_box)
    
    # 변환될 실제 좌표 (Top-view)
    # (0,0), (30,0), (30,30), (0,30) 순서
    dst_pts = np.array([
        [0, 0],
        [BLOCK_REAL_SIZE, 0],
        [BLOCK_REAL_SIZE, BLOCK_REAL_SIZE],
        [0, BLOCK_REAL_SIZE]
    ], dtype="float32")

    # 변환 행렬 계산
    M = cv2.getPerspectiveTransform(rect, dst_pts)
    return M

def transform_point(point, M):
    """
    점 하나를 호모그래피 행렬 M을 이용해 변환합니다.
    """
    src = np.array([[[point[0], point[1]]]], dtype="float32")
    dst = cv2.perspectiveTransform(src, M)
    return dst[0][0]

def calculate_distance(p1, p2):
    """두 점 (x1, y1), (x2, y2) 사이의 유클리드 거리를 계산합니다."""
    return math.sqrt((p1[0] - p2[0])**2 + (p1[1] - p2[1])**2)

def main():
    try:
        # 이미지 읽기 (해상도 확인용)
        if not os.path.exists(image_file_path):
            print(f"이미지 파일을 찾을 수 없습니다: {image_file_path}")
            return
            
        img = cv2.imread(image_file_path)
        h, w, _ = img.shape
        
        base_point = (w / 2, h)
        print(f"기준점(하단 중앙): {base_point}")

        with open(json_file_path, "r", encoding="utf-8") as f:
            data = json.load(f)
            
        print(f"총 {len(data)}개의 객체가 탐지되었습니다.\n")

        # 1. 기준(Reference) 블록 찾기
        # 보정의 기준이 될 블록 선정 (여기서는 '하단 중앙 기준점'과 가장 가까운 객체를 기준으로 삼음)
        closest_idx = -1
        min_base_dist = float('inf')
        
        # 데이터 전처리: 좌표 추출
        objects = []
        for i, item in enumerate(data):
            box = item.get("box", {})
            pts = [
                (box.get("x1"), box.get("y1")),
                (box.get("x2"), box.get("y2")),
                (box.get("x3"), box.get("y3")),
                (box.get("x4"), box.get("y4"))
            ]
            if None in [c for pt in pts for c in pt]:
                continue
            
            # 객체 중심점 계산 (단순 평균)
            center_x = sum(p[0] for p in pts) / 4
            center_y = sum(p[1] for p in pts) / 4
            dist_to_base = calculate_distance((center_x, center_y), base_point)
            
            objects.append({
                "index": i,
                "data": item,
                "points": np.array(pts, dtype="float32"),
                "dist_to_base": dist_to_base
            })
            
            # 가장 가까운 객체 갱신
            if dist_to_base < min_base_dist:
                min_base_dist = dist_to_base
                closest_idx = len(objects) - 1

        if closest_idx == -1:
            print("유효한 객체가 없습니다.")
            return

        # 원근 변환 행렬(Homography) 구하기
        ref_obj = objects[closest_idx]
        print(f"== 원근 보정 기준 객체: [{ref_obj['index']+1}]번 {ref_obj['data'].get('name')} ==")
        print(f"   (가장 가까운 블록을 30x30cm 정규격으로 가정하여 비례식을 계산합니다)\n")
        
        M = get_perspective_transform_matrix(ref_obj["points"])
        
        # 기준점(내 발 밑)도 변환된 좌표계(Top-view)로 변경
        base_point_real = transform_point(base_point, M)

        # 2. 모든 객체에 대해 실제 거리 계산
        for obj in objects:
            i = obj["index"]
            item = obj["data"]
            points = obj["points"]
            
            # 객체의 4개 점을 모두 실제 좌표계(cm 단위)로 변환
            real_points = [transform_point(pt, M) for pt in points]
            
            # 변환된 좌표계에서의 최단 거리 점 찾기
            min_real_dist = float('inf')
            closest_real_pt = None
            
            for r_pt in real_points:
                # Top-view 상에서의 유클리드 거리 (단위: cm)
                d = calculate_distance(r_pt, base_point_real)
                if d < min_real_dist:
                    min_real_dist = d
                    closest_real_pt = r_pt

            # 실제 가로/세로 거리 (cm)
            real_dist_x = abs(closest_real_pt[0] - base_point_real[0])
            real_dist_y = abs(closest_real_pt[1] - base_point_real[1])

            print(f"[{i+1}] 객체: {item.get('name')} (Confidence: {item.get('confidence'):.4f})")
            print(f"    - 실제 직선 거리: {min_real_dist:.1f} cm (약 {min_real_dist/100:.2f} m)")
            print(f"        * 좌우 거리(X축): {real_dist_x:.1f} cm")
            print(f"        * 전후 거리(Y축): {real_dist_y:.1f} cm")
            print("-" * 30)


    except FileNotFoundError:
        print(f"파일을 찾을 수 없습니다: {json_file_path}")
    except json.JSONDecodeError:
        print(f"JSON 파일 형식이 올바르지 않습니다: {json_file_path}")
    except Exception as e:
        print(f"오류 발생: {e}")

if __name__ == "__main__":
    main()
