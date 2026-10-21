# -*- coding: utf-8 -*-
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from patchlib import op, apply

op(
    "src/components/catalog/catalog-content.tsx",
    r"""                  <button
                    key={type}
                    onClick={() => toggleType(type)}
                    className={cn(
""",
    r"""                  <button
                    key={type}
                    onClick={() => toggleType(type)}
                    aria-label={
                      active
                        ? `Retirer le filtre ${getCategoryLabel(type)}`
                        : `Filtrer sur ${getCategoryLabel(type)}`
                    }
                    className={cn(
""",
)

op(
    "src/components/catalog/catalog-content.tsx",
    r"""              <button
                onClick={() => toggleType(type)}
                className="ml-0.5 hover:text-primary/70"
                aria-label={`Retirer le filtre ${getCategoryLabel(type)}`}
              >
""",
    r"""              <button
                onClick={() => toggleType(type)}
                className="ml-0.5 hover:text-primary/70"
                aria-label={`Retirer ${getCategoryLabel(type)} des résultats`}
              >
""",
)

apply()
