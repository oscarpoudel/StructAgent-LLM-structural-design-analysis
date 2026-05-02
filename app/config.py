from functools import lru_cache
import secrets

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    ollama_base_url: str = "http://localhost:11434"
    ollama_model: str = "glm-4.7-flash:latest"
    agent_llm_provider: str = "ollama"
    agent_llm_timeout_s: float = 8.0
    app_env: str = "development"
    app_secret_key: str = ""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    def __post_init__(self):
        if not self.app_secret_key:
            self.app_secret_key = secrets.token_hex(32)


@lru_cache
def get_settings() -> Settings:
    return Settings()
