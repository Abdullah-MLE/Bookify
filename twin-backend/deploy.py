import os
import shutil
import zipfile
import subprocess


def main():
    print("Creating Lambda deployment package using Docker...")

    if os.path.exists("lambda-deployment.zip"):
        os.remove("lambda-deployment.zip")

    # The shell script to run inside the Docker container
    # This does everything in Linux, avoiding Windows volume mount slow downs for small files
    docker_script = """
    mkdir -p /tmp/pkg
    echo "Installing dependencies..."
    pip install -r /var/task/requirements.txt -t /tmp/pkg --platform manylinux2014_x86_64 --only-binary=:all: --upgrade --quiet
    
    echo "Copying application files..."
    cp /var/task/server.py /var/task/lambda_handler.py /var/task/context.py /var/task/resources.py /tmp/pkg/ 2>/dev/null || true
    if [ -f /var/task/me.txt ]; then cp /var/task/me.txt /tmp/pkg/; fi
    
    echo "Copying directories..."
    cp -r /var/task/data /var/task/libs /var/task/etc /tmp/pkg/ 2>/dev/null || true
    
    echo "Cleaning up redundant libraries and cache..."
    cd /tmp/pkg
    rm -rf boto3* botocore* s3transfer*
    find . -type d -name __pycache__ -exec rm -r {} +
    
    echo "Zipping package..."
    python -c "import zipfile, os; z=zipfile.ZipFile('/var/task/lambda-deployment.zip', 'w', zipfile.ZIP_DEFLATED); [z.write(os.path.join(r, f), os.path.relpath(os.path.join(r, f), '.')) for r, d, files in os.walk('.') for f in files]; z.close()"
    
    echo "Done!"
    """

    subprocess.run(
        [
            "docker",
            "run",
            "--rm",
            "-v",
            f"{os.getcwd()}:/var/task",
            "--platform",
            "linux/amd64",
            "--entrypoint",
            "sh",
            "public.ecr.aws/lambda/python:3.12",
            "-c",
            docker_script,
        ],
        check=True,
    )

    if os.path.exists("lambda-deployment.zip"):
        size_mb = os.path.getsize("lambda-deployment.zip") / (1024 * 1024)
        print(f"Success! Created lambda-deployment.zip ({size_mb:.2f} MB)")
    else:
        print("Failed to create lambda-deployment.zip")


if __name__ == "__main__":
    main()
